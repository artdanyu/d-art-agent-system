/**
 * Cloudflare Turnstile server-side verification (optional bot protection for source=web).
 */
export async function verifyTurnstileToken(token, remoteIp) {
  const secret = (process.env.TURNSTILE_SECRET_KEY || '').trim();
  if (!secret || !token || typeof token !== 'string') {
    return false;
  }

  const body = new URLSearchParams();
  body.set('secret', secret);
  body.set('response', token.slice(0, 2048));
  if (remoteIp && remoteIp !== 'unknown') {
    body.set('remoteip', remoteIp.slice(0, 64));
  }

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const data = await res.json().catch(() => ({}));
    return Boolean(data.success);
  } catch {
    return false;
  }
}
