/**
 * Лиды: только Telegram (@username) и телефон.
 * Email намеренно не используется.
 */

function extractTelegramHandle(text) {
  const t = text.trim();
  const m1 = t.match(/(?:^|[\s,;])@([a-zA-Z][a-zA-Z0-9_]{4,32})\b/);
  if (m1) return '@' + m1[1];
  const m2 = t.match(/(?:telegram|тг|tg)\s*[:\s@]+([a-zA-Z][a-zA-Z0-9_]{4,32})/i);
  if (m2) return '@' + m2[1];
  return null;
}

function extractPhone(text) {
  const e164 = text.match(/\+[1-9]\d{9,14}\b/);
  if (e164) return e164[0];

  const ru = text.match(
    /(?:\+?7|8)\s*\(?\d{3}\)?\s*\d{3}[\s\-]?\d{2}[\s\-]?\d{2}/
  );
  if (ru) {
    const d = ru[0].replace(/\D/g, '');
    if (d.length === 11) return '+7' + d.slice(-10);
  }

  const compact = text.replace(/\D/g, '');
  if (compact.length === 11 && /^[78]/.test(compact)) {
    return '+7' + compact.slice(-10);
  }
  if (compact.length === 10) {
    return '+7' + compact;
  }

  return null;
}

export function extractContactChannels(text) {
  if (!text || typeof text !== 'string') return null;
  const tg = extractTelegramHandle(text);
  const phone = extractPhone(text);
  if (!tg && !phone) return null;
  const parts = [];
  if (tg) parts.push(`telegram:${tg}`);
  if (phone) parts.push(`tel:${phone}`);
  return {
    display: parts.join(' | '),
    tg,
    phone,
  };
}

export function tryAutoCaptureLead(db, { internalUserId, agentId, source, userText }) {
  const ch = extractContactChannels(userText);
  if (!ch) {
    return { saved: false };
  }

  const insertLead = db.prepare(
    `INSERT INTO leads (user_id, agent_id, name, contact, task, source)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  const task = userText.trim().slice(0, 1200);
  const info = insertLead.run(
    internalUserId,
    agentId || null,
    null,
    ch.display,
    task,
    source
  );

  const leadId = Number(info.lastInsertRowid);
  console.log('[D-Art] lead captured', { leadId, source, channels: ch.display });

  return { saved: true, leadId, contact: ch.display };
}
