/**
 * IP клиента (за reverse proxy — нужен trust proxy + заголовок).
 */
export function getClientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length) {
    return xf.split(',')[0].trim().slice(0, 64) || 'unknown';
  }
  if (req.socket?.remoteAddress) {
    return String(req.socket.remoteAddress).slice(0, 64);
  }
  return 'unknown';
}
