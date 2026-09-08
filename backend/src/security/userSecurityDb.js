/**
 * Статус пользователя в БД: active / limited / blocked.
 */

export function ensureSecuritySchema(db) {
  const pragma = db.prepare(`PRAGMA table_info(users)`).all();
  const have = new Set(pragma.map((c) => c.name));
  const add = (sql) => db.exec(sql);
  if (!have.has('security_status')) {
    add(`ALTER TABLE users ADD COLUMN security_status TEXT NOT NULL DEFAULT 'active'`);
  }
  if (!have.has('limited_until')) {
    add(`ALTER TABLE users ADD COLUMN limited_until TEXT`);
  }
  if (!have.has('last_ip')) {
    add(`ALTER TABLE users ADD COLUMN last_ip TEXT`);
  }
  if (!have.has('msg_count')) {
    add(`ALTER TABLE users ADD COLUMN msg_count INTEGER NOT NULL DEFAULT 0`);
  }
  if (!have.has('last_active_at')) {
    add(`ALTER TABLE users ADD COLUMN last_active_at TEXT`);
  }
}

export function parseIsoOrNull(iso) {
  if (!iso || typeof iso !== 'string') return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

export function isUserAccessBlocked(row) {
  if (!row) return { blocked: false };
  if (row.security_status === 'blocked') return { blocked: true, reason: 'blocked' };
  if (row.security_status === 'limited' && row.limited_until) {
    const until = parseIsoOrNull(row.limited_until);
    if (until !== null && Date.now() < until) {
      return { blocked: true, limited: true, reason: 'limited' };
    }
  }
  return { blocked: false };
}

export function expireLimitedIfPast(db, userId) {
  const row = db.prepare(`SELECT security_status, limited_until FROM users WHERE id = ?`).get(userId);
  if (!row || row.security_status !== 'limited' || !row.limited_until) return;
  const until = parseIsoOrNull(row.limited_until);
  if (until !== null && Date.now() >= until) {
    db.prepare(
      `UPDATE users SET security_status = 'active', limited_until = NULL WHERE id = ?`
    ).run(userId);
  }
}

export function createSecurityStatements(db) {
  return {
    getFlags: db.prepare(`SELECT security_status, limited_until FROM users WHERE id = ?`),
    bumpActivity: db.prepare(
      `UPDATE users SET last_ip = ?, msg_count = COALESCE(msg_count, 0) + 1,
       last_active_at = datetime('now') WHERE id = ?`
    ),
    setLimited: db.prepare(
      `UPDATE users SET security_status = 'limited', limited_until = ? WHERE id = ?`
    ),
    setBlocked: db.prepare(
      `UPDATE users SET security_status = 'blocked', limited_until = NULL WHERE id = ?`
    ),
  };
}
