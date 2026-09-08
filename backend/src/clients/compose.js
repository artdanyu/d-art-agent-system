import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Папка `agent_system/backend/clients/` — по одной подпапке на клиента. */
export const CLIENTS_DIR = path.join(__dirname, '..', '..', 'clients');

export function folderForAgent(agentId) {
  return agentId === 'default' ? 'dart-art' : agentId;
}

export function clientDir(agentId) {
  return path.join(CLIENTS_DIR, folderForAgent(agentId));
}

export function hasClientPack(agentId) {
  const sysPath = path.join(clientDir(agentId), 'system.md');
  return fs.existsSync(sysPath);
}

/**
 * Собирает полный system prompt из system.md + contacts.json + knowledge.json.
 * @param {string} agentId — id в API (`default` для D-Art → папка `dart-art`)
 */
export function composeClientSystemPrompt(agentId) {
  const dir = clientDir(agentId);
  const sysPath = path.join(dir, 'system.md');
  if (!fs.existsSync(sysPath)) return null;

  let text = fs.readFileSync(sysPath, 'utf8').trim();

  const contactsPath = path.join(dir, 'contacts.json');
  if (fs.existsSync(contactsPath)) {
    try {
      const c = JSON.parse(fs.readFileSync(contactsPath, 'utf8'));
      const phone = (c.phone || '').trim();
      const tg = (c.telegram || '').trim();
      if (phone || tg) {
        text +=
          '\n\n---\nОфициальные контакты (при запросе связи сообщай клиенту именно их; другие номера и ники не придумывай):\n';
        if (phone) text += `Телефон: ${phone}\n`;
        if (tg) text += `Telegram: ${tg}\n`;
      }
    } catch (_) {
      /* ignore bad json */
    }
  }

  const knPath = path.join(dir, 'knowledge.json');
  if (fs.existsSync(knPath)) {
    try {
      const obj = JSON.parse(fs.readFileSync(knPath, 'utf8'));
      text +=
        '\n\n---\nСправочный контекст (JSON). Используй выборочно, не зачитывай целиком:\n' +
        JSON.stringify(obj, null, 2);
    } catch (_) {
      /* ignore */
    }
  }

  return text;
}

export function readDisplayName(folderName) {
  const metaPath = path.join(CLIENTS_DIR, folderName, 'meta.json');
  if (fs.existsSync(metaPath)) {
    try {
      const m = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      if (m.name && String(m.name).trim()) return String(m.name).trim();
    } catch (_) {
      /* ignore */
    }
  }
  return folderName === 'dart-art' ? 'D-Art Consultant' : folderName;
}

function upsertAgent(db, agentId, name, systemPrompt) {
  db.prepare(
    `INSERT INTO agents (id, name, system_prompt) VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       system_prompt = excluded.system_prompt`
  ).run(agentId, name, systemPrompt);
}

/** При старте сервера: все папки с system.md → строки в таблице agents. */
export function syncAgentsFromClients(db) {
  if (!fs.existsSync(CLIENTS_DIR)) return;

  for (const folder of fs.readdirSync(CLIENTS_DIR)) {
    if (folder.startsWith('.') || folder.startsWith('_')) continue;
    const dir = path.join(CLIENTS_DIR, folder);
    if (!fs.statSync(dir).isDirectory()) continue;
    const sysPath = path.join(dir, 'system.md');
    if (!fs.existsSync(sysPath)) continue;

    const agentId = folder === 'dart-art' ? 'default' : folder;
    const prompt = composeClientSystemPrompt(agentId);
    if (!prompt) continue;
    const name = readDisplayName(folder);
    upsertAgent(db, agentId, name, prompt);
  }
}

/**
 * Если для agentId есть папка клиента, но строки в БД ещё нет — создать/обновить.
 * @returns {boolean} true если агент теперь можно взять из БД
 */
export function ensureAgentFromClientFolder(db, agentId) {
  if (!hasClientPack(agentId)) return false;
  const folder = folderForAgent(agentId);
  const prompt = composeClientSystemPrompt(agentId);
  if (!prompt) return false;
  const name = readDisplayName(folder);
  upsertAgent(db, agentId, name, prompt);
  return true;
}
