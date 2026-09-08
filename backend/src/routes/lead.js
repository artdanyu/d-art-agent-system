import { Router } from 'express';
import { getClientIp } from '../security/clientIp.js';
import { checkIpRateLimit } from '../security/ipRateLimit.js';
import { checkFingerprintRateLimit } from '../security/fingerprintRateLimit.js';
import { MSG_UNAVAILABLE } from '../security/messages.js';
import { notifyLeadSavedAsync } from '../notify/telegramLead.js';

const ALLOWED_SOURCES = new Set(['web', 'telegram']);

const MAX_NAME = 200;
const MAX_CONTACT = 500;
const MAX_TASK = 4000;
const MAX_AGENT_ID_LEN = 64;
const AGENT_ID_RE = /^[a-zA-Z0-9._-]+$/;

function truncateField(val, max) {
  if (val == null) return null;
  if (typeof val !== 'string') return null;
  const t = val.trim();
  if (!t) return null;
  return t.slice(0, max);
}

export function createLeadRouter(db) {
  const router = Router();

  const getUser = db.prepare(
    `SELECT id FROM users WHERE external_id = ? AND source = ?`
  );
  const insertUser = db.prepare(
    `INSERT INTO users (external_id, source) VALUES (?, ?)`
  );
  const insertLead = db.prepare(
    `INSERT INTO leads (user_id, agent_id, name, contact, task, source)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  router.post('/', (req, res) => {
    const ip = getClientIp(req);
    if (!checkIpRateLimit(ip).ok || !checkFingerprintRateLimit(req).ok) {
      return res.status(429).json({ error: MSG_UNAVAILABLE });
    }

    const body = req.body || {};
    const {
      userId,
      agentId = 'default',
      name,
      task,
      source,
    } = body;
    const contact =
      body.contact != null && body.contact !== ''
        ? body.contact
        : body.phone != null
          ? body.phone
          : undefined;

    if (!source || !ALLOWED_SOURCES.has(source)) {
      return res.status(400).json({ error: 'source must be "web" or "telegram"' });
    }

    const aid = typeof agentId === 'string' ? agentId : 'default';
    if (aid.length > MAX_AGENT_ID_LEN || !AGENT_ID_RE.test(aid)) {
      return res.status(400).json({ error: 'invalid agentId' });
    }

    const nameT = truncateField(name, MAX_NAME);
    const contactT = truncateField(contact, MAX_CONTACT);
    const taskT = truncateField(task, MAX_TASK);

    if (!nameT && !contactT && !taskT) {
      return res.status(400).json({ error: 'Provide at least one of: name, contact, task' });
    }

    let userIdInternal = null;
    if (userId && typeof userId === 'string') {
      if (userId.length > 128 || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(userId)) {
        return res.status(400).json({ error: 'invalid userId' });
      }
      let user = getUser.get(userId, source);
      if (!user) {
        const info = insertUser.run(userId, source);
        user = { id: Number(info.lastInsertRowid) };
      }
      userIdInternal = user.id;
    }

    const info = insertLead.run(
      userIdInternal,
      aid || null,
      nameT,
      contactT,
      taskT,
      source
    );

    const leadId = Number(info.lastInsertRowid);
    notifyLeadSavedAsync({
      kind: 'web_form',
      leadId,
      name: nameT,
      contact: contactT,
      task: taskT,
      source,
      agentId: aid,
    });

    res.status(201).json({
      ok: true,
      leadId,
    });
  });

  return router;
}
