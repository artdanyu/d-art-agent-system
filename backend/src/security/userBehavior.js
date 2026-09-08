/**
 * Поведение пользователя: минимальный интервал между сообщениями, дубликаты.
 * In-memory, O(1).
 */
const lastMsg = new Map(); // userKey -> { t, norm, dupStreak }

function userKey(source, externalId) {
  return `${source}:${externalId}`;
}

function normalizeForDup(s) {
  return s
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}

function minIntervalMs() {
  return Math.max(800, Number(process.env.CHAT_MIN_INTERVAL_MS || 1400));
}

function maxDupStreak() {
  return Math.max(3, Number(process.env.CHAT_MAX_DUP_STREAK || 5));
}

/**
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function checkUserMessagePacing(source, externalId, text) {
  const key = userKey(source, externalId);
  const now = Date.now();
  const norm = normalizeForDup(text);
  const prev = lastMsg.get(key);

  if (prev) {
    const dt = now - prev.t;
    if (dt < minIntervalMs()) {
      return { ok: false, reason: 'too_fast' };
    }
    if (norm.length > 3 && norm === prev.norm) {
      const streak = (prev.dupStreak || 0) + 1;
      if (streak >= maxDupStreak()) {
        lastMsg.set(key, { t: now, norm, dupStreak: streak });
        return { ok: false, reason: 'duplicate_spam' };
      }
      lastMsg.set(key, { t: now, norm, dupStreak: streak });
      return { ok: true };
    }
  }

  lastMsg.set(key, { t: now, norm, dupStreak: 0 });
  return { ok: true };
}

export function resetUserPacing(source, externalId) {
  lastMsg.delete(userKey(source, externalId));
}
