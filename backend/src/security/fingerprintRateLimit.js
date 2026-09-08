/**
 * Secondary limit: hash(IP + User-Agent) to throttle scripted abuse behind NAT.
 */
import crypto from 'crypto';
import { getClientIp } from './clientIp.js';

const WINDOW_MS = 60_000;
const buckets = new Map();

function maxFpPerWindow() {
  return Math.max(8, Number(process.env.RATE_LIMIT_FINGERPRINT_PER_MIN || 20));
}

export function checkFingerprintRateLimit(req) {
  const ip = getClientIp(req);
  const ua = String(req.get('user-agent') || '').slice(0, 400);
  const key = crypto.createHash('sha256').update(`${ip}|${ua}`).digest('hex').slice(0, 32);

  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now - b.start > WINDOW_MS) {
    buckets.set(key, { start: now, count: 1 });
    return { ok: true };
  }
  b.count += 1;
  if (b.count > maxFpPerWindow()) {
    return { ok: false, reason: 'fp_rate' };
  }
  return { ok: true };
}

export function pruneFingerprintBuckets(maxAgeMs = 120_000) {
  const now = Date.now();
  for (const [k, v] of buckets) {
    if (now - v.start > maxAgeMs) buckets.delete(k);
  }
}
