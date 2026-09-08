/**
 * Счётчик нарушений по пользователю → автолимит / блок в БД.
 */
const counts = new Map();

function key(source, externalId) {
  return `${source}:${externalId}`;
}

function maxBeforeLimited() {
  return Math.max(5, Number(process.env.AUTO_LIMIT_VIOLATIONS || 10));
}

function maxBeforeBlocked() {
  return Math.max(15, Number(process.env.AUTO_BLOCK_VIOLATIONS || 25));
}

export function registerViolation(source, externalId) {
  const k = key(source, externalId);
  const n = (counts.get(k) || 0) + 1;
  counts.set(k, n);
  return n;
}

export function resetViolations(source, externalId) {
  counts.delete(key(source, externalId));
}

export function violationTier(n) {
  if (n >= maxBeforeBlocked()) return 'block';
  if (n >= maxBeforeLimited()) return 'limit';
  return 'none';
}
