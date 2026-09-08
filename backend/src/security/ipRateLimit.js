/**
 * Sliding window per IP: in-memory limits (no Redis).
 * Per-minute + per-hour to limit sustained token draining.
 */
import { pruneFingerprintBuckets } from './fingerprintRateLimit.js';

const MIN_WINDOW_MS = 60_000;
const HOUR_MS = 60 * 60_000;
const minBuckets = new Map();
const hourBuckets = new Map();

function maxPerMinute() {
  return Math.max(5, Number(process.env.RATE_LIMIT_IP_PER_MIN || 30));
}

function maxPerHour() {
  return Math.max(60, Number(process.env.RATE_LIMIT_IP_PER_HOUR || 200));
}

export function checkIpRateLimit(ip) {
  const now = Date.now();
  const key = ip || 'unknown';

  let b = minBuckets.get(key);
  if (!b || now - b.start > MIN_WINDOW_MS) {
    b = { start: now, count: 0 };
    minBuckets.set(key, b);
  }
  b.count += 1;

  let h = hourBuckets.get(key);
  if (!h || now - h.start > HOUR_MS) {
    h = { start: now, count: 0 };
    hourBuckets.set(key, h);
  }
  h.count += 1;

  if (b.count > maxPerMinute()) {
    return { ok: false, reason: 'ip_rate_min' };
  }
  if (h.count > maxPerHour()) {
    return { ok: false, reason: 'ip_rate_hour' };
  }
  return { ok: true };
}

/** Очистка старых записей, чтобы Map не рос бесконечно */
export function pruneIpBuckets(maxAgeMs = 120_000) {
  const now = Date.now();
  for (const [k, v] of minBuckets) {
    if (now - v.start > maxAgeMs) minBuckets.delete(k);
  }
  for (const [k, v] of hourBuckets) {
    if (now - v.start > HOUR_MS + 60_000) hourBuckets.delete(k);
  }
}

setInterval(() => {
  pruneIpBuckets();
  pruneFingerprintBuckets();
}, 120_000).unref?.();
