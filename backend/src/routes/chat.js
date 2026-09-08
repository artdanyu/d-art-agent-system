import { Router } from 'express';
import { chatCompletion } from '../services/deepseek.js';
import { buildSystemPrompt } from '../prompts/buildSystemPrompt.js';
import { tryAutoCaptureLead } from '../leads/autoCapture.js';
import { notifyLeadSavedAsync } from '../notify/telegramLead.js';
import { getClientIp } from '../security/clientIp.js';
import { checkIpRateLimit } from '../security/ipRateLimit.js';
import { checkFingerprintRateLimit } from '../security/fingerprintRateLimit.js';
import { checkUserMessagePacing } from '../security/userBehavior.js';
import { analyzeUserMessage } from '../security/promptInjection.js';
import { guardAssistantReply } from '../security/outputGuard.js';
import { ensureAgentFromClientFolder } from '../clients/compose.js';
import { MSG_UNAVAILABLE, MSG_ERROR, MSG_SCOPE_ONLY } from '../security/messages.js';
import { registerViolation, violationTier } from '../security/violations.js';
import {
  expireLimitedIfPast,
  createSecurityStatements,
  isUserAccessBlocked,
} from '../security/userSecurityDb.js';

const ALLOWED_SOURCES = new Set(['web', 'telegram']);
const HISTORY_LIMIT = 15;
const MAX_USER_ID_LEN = 128;
const MAX_AGENT_ID_LEN = 64;
const AGENT_ID_RE = /^[a-zA-Z0-9._-]+$/;

function maxMessageChars() {
  const n = Number(process.env.CHAT_MAX_MESSAGE_CHARS || 6000);
  return Math.min(16000, Math.max(256, n));
}

function validateUserId(s) {
  if (typeof s !== 'string') return false;
  if (s.length < 1 || s.length > MAX_USER_ID_LEN) return false;
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(s)) return false;
  return true;
}

function validateAgentId(s) {
  return typeof s === 'string' && s.length <= MAX_AGENT_ID_LEN && AGENT_ID_RE.test(s);
}

function isBlockedByEnv(externalUserId) {
  const raw = process.env.BLOCKED_EXTERNAL_IDS || '';
  const ids = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.includes(externalUserId);
}

export function createChatRouter(db) {
  const router = Router();

  const getUser = db.prepare(
    `SELECT id FROM users WHERE external_id = ? AND source = ?`
  );
  const insertUser = db.prepare(
    `INSERT INTO users (external_id, source) VALUES (?, ?)`
  );
  const getAgent = db.prepare(`SELECT id, name, system_prompt FROM agents WHERE id = ?`);
  const insertMessage = db.prepare(
    `INSERT INTO messages (user_id, agent_id, role, content, source) VALUES (?, ?, ?, ?, ?)`
  );
  const listHistory = db.prepare(`
    SELECT role, content FROM messages
    WHERE user_id = ? AND agent_id = ?
    ORDER BY id DESC
    LIMIT ?
  `);

  const sec = createSecurityStatements(db);

  router.post('/', async (req, res) => {
    try {
      const { message, userId, agentId = 'default', source } = req.body || {};

      const ip = getClientIp(req);
      if (!checkIpRateLimit(ip).ok || !checkFingerprintRateLimit(req).ok) {
        return res.status(429).json({ error: MSG_UNAVAILABLE });
      }

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'message is required (string)' });
      }
      const maxChars = maxMessageChars();
      if (message.length > maxChars) {
        return res.status(400).json({ error: 'message too long' });
      }
      if (!userId || typeof userId !== 'string' || !validateUserId(userId)) {
        return res.status(400).json({ error: 'userId is required (valid string)' });
      }
      if (!validateAgentId(agentId)) {
        return res.status(400).json({ error: 'invalid agentId' });
      }
      if (!source || !ALLOWED_SOURCES.has(source)) {
        return res.status(400).json({ error: 'source must be "web" or "telegram"' });
      }

      if (isBlockedByEnv(userId)) {
        return res.status(403).json({ error: MSG_UNAVAILABLE });
      }

      let user = getUser.get(userId, source);
      if (!user) {
        const info = insertUser.run(userId, source);
        user = { id: Number(info.lastInsertRowid) };
      }

      expireLimitedIfPast(db, user.id);
      const flags = sec.getFlags.get(user.id);
      if (isUserAccessBlocked(flags).blocked) {
        return res.status(403).json({ error: MSG_UNAVAILABLE });
      }

      let agent = getAgent.get(agentId);
      if (!agent) {
        ensureAgentFromClientFolder(db, agentId);
        agent = getAgent.get(agentId);
      }
      if (!agent) {
        return res.status(404).json({ error: `Unknown agentId: ${agentId}` });
      }

      const rawTrimmed = message.trim();
      if (!rawTrimmed) {
        return res.status(400).json({ error: 'message is empty' });
      }

      const pacing = checkUserMessagePacing(source, userId, rawTrimmed);
      if (!pacing.ok) {
        const n = registerViolation(source, userId);
        const tier = violationTier(n);
        if (tier === 'limit') {
          sec.setLimited.run(
            new Date(Date.now() + 15 * 60 * 1000).toISOString(),
            user.id
          );
        } else if (tier === 'block') {
          sec.setBlocked.run(user.id);
        }
        return res.status(429).json({ error: MSG_UNAVAILABLE });
      }

      const inj = analyzeUserMessage(rawTrimmed);
      if (inj.blockModel) {
        const vn = registerViolation(source, userId);
        const tr = violationTier(vn);
        if (tr === 'block') sec.setBlocked.run(user.id);
        else if (tr === 'limit') {
          sec.setLimited.run(
            new Date(Date.now() + 30 * 60 * 1000).toISOString(),
            user.id
          );
        }
        return res.json({
          reply: MSG_SCOPE_ONLY,
          userId,
          agentId,
          source,
          leadSaved: false,
        });
      }

      let textForModel = inj.text;
      if (!textForModel || textForModel === '[фильтр]') {
        return res.json({
          reply: MSG_SCOPE_ONLY,
          userId,
          agentId,
          source,
          leadSaved: false,
        });
      }

      let leadSaved = false;
      try {
        const cap = tryAutoCaptureLead(db, {
          internalUserId: user.id,
          agentId,
          source,
          userText: rawTrimmed,
        });
        leadSaved = cap.saved;
        if (cap.saved && cap.leadId != null) {
          notifyLeadSavedAsync({
            kind: 'chat_capture',
            leadId: cap.leadId,
            contact: cap.contact,
            source,
            externalUserId: userId,
            agentId,
          });
        }
      } catch (err) {
        console.error('[D-Art] lead capture failed', err);
      }

      const historyRows = listHistory.all(user.id, agentId, HISTORY_LIMIT);
      historyRows.reverse();

      const systemContent = buildSystemPrompt(agentId, agent);
      const messages = [{ role: 'system', content: systemContent }];

      for (const row of historyRows) {
        if (row.role === 'user' || row.role === 'assistant') {
          messages.push({ role: row.role, content: row.content });
        }
      }
      messages.push({ role: 'user', content: textForModel });

      let reply;
      try {
        const capTokens = Math.min(
          2048,
          Math.max(256, Number(process.env.DEEPSEEK_MAX_TOKENS || 1200))
        );
        const { reply: rawReply } = await chatCompletion({
          messages,
          temperature: 0.65,
          maxTokens: capTokens,
        });
        reply = guardAssistantReply(rawReply, { maxLength: 1800 });

        if (!reply) {
          reply = MSG_ERROR;
        }
      } catch (e) {
        console.error('[D-Art] DeepSeek error', e.message || e);
        return res.json({
          reply: MSG_ERROR,
          userId,
          agentId,
          source,
          leadSaved,
        });
      }

      try {
        sec.bumpActivity.run(ip, user.id);
        insertMessage.run(user.id, agentId, 'user', textForModel, source);
        insertMessage.run(user.id, agentId, 'assistant', reply, source);
      } catch (e) {
        console.error('[D-Art] persist message', e);
      }

      return res.json({
        reply,
        userId,
        agentId,
        source,
        leadSaved,
      });
    } catch (e) {
      console.error('[D-Art] chat fatal', e);
      return res.json({
        reply: MSG_ERROR,
        userId: req.body?.userId,
        agentId: req.body?.agentId || 'default',
        source: req.body?.source,
        leadSaved: false,
      });
    }
  });

  return router;
}
