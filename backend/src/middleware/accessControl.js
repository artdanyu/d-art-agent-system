import { getClientIp } from '../security/clientIp.js';
import { verifyTurnstileToken } from '../security/turnstile.js';

function getSentApiKey(req) {
  return (
    req.get('x-api-key') ||
    req.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    ''
  ).trim();
}

/**
 * Production: require either a valid API key or (for source=web) a verified Turnstile token
 * when API_KEY is set — so browser widgets never embed the server API key.
 * Without API_KEY: local/dev; production must set ALLOW_ANONYMOUS_ACCESS=1 or configure keys.
 */
export function accessControl(req, res, next) {
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  const expected = (process.env.API_KEY || '').trim();
  const isProd = process.env.NODE_ENV === 'production';

  if (!expected) {
    if (isProd && process.env.ALLOW_ANONYMOUS_ACCESS !== '1') {
      return res.status(503).json({ error: 'Service unavailable' });
    }
    return next();
  }

  const sent = getSentApiKey(req);
  if (sent === expected) {
    return next();
  }

  const source = req.body?.source;
  const turnstileToken = req.body?.turnstileToken || req.body?.cfTurnstileResponse;

  if (source === 'web' && (process.env.TURNSTILE_SECRET_KEY || '').trim()) {
    const ip = getClientIp(req);
    return verifyTurnstileToken(turnstileToken, ip).then((ok) => {
      if (ok) return next();
      return res.status(401).json({ error: 'Unauthorized' });
    });
  }

  return res.status(401).json({ error: 'Unauthorized' });
}
