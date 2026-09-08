import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { CONSULTANT_SYSTEM_PROMPT } from './prompts/dartConsultant.js';
import { ensureSecuritySchema } from './security/userSecurityDb.js';

/** В БД для default; при наличии clients/dart-art/ промпт подставляется из файлов при старте (syncAgentsFromClients). */
const DEFAULT_SYSTEM_PROMPT = CONSULTANT_SYSTEM_PROMPT;

export function openDb(dbPath) {
  const resolved = path.isAbsolute(dbPath) ? dbPath : path.join(process.cwd(), dbPath);
  const dir = path.dirname(resolved);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // SQLite file DB: not network-exposed; restrict file permissions on the host (e.g. chmod 600) and backups.
  const db = new DatabaseSync(resolved);
  db.exec('PRAGMA journal_mode = WAL;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      system_prompt TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      external_id TEXT NOT NULL,
      source TEXT NOT NULL CHECK (source IN ('web', 'telegram')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (external_id, source)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      agent_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      source TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (agent_id) REFERENCES agents(id)
    );

    CREATE INDEX IF NOT EXISTS idx_messages_user_agent ON messages(user_id, agent_id, created_at);

    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      agent_id TEXT,
      name TEXT,
      contact TEXT,
      task TEXT,
      source TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (agent_id) REFERENCES agents(id)
    );
  `);

  const row = db.prepare(`SELECT id FROM agents WHERE id = 'default'`).get();
  if (!row) {
    db.prepare(`INSERT INTO agents (id, name, system_prompt) VALUES ('default', 'D-Art Consultant', ?)`).run(
      DEFAULT_SYSTEM_PROMPT
    );
  }

  ensureSecuritySchema(db);

  return db;
}
