import fs from 'fs';
import path from 'path';
import { clientDir } from '../clients/compose.js';

/**
 * Уведомления о лидах в Telegram. Один бот (TELEGRAM_NOTIFY_BOT_TOKEN), чаты — по агенту/сайту.
 *
 * Приоритет chat_id:
 * 1) JSON в TELEGRAM_NOTIFY_BY_AGENT, например {"default":"111","123okna":"222"}
 * 2) clients/<папка>/notify.json с полем "telegramChatId" (у default — папка dart-art)
 * 3) TELEGRAM_NOTIFY_CHAT_ID (как раньше — один общий чат)
 */
function resolveNotifyChatId(agentId) {
  const aid =
    agentId && String(agentId).trim() ? String(agentId).trim() : 'default';

  const fromMap = (process.env.TELEGRAM_NOTIFY_BY_AGENT || '').trim();
  if (fromMap) {
    try {
      const map = JSON.parse(fromMap);
      if (map && typeof map === 'object' && map[aid] != null) {
        const c = String(map[aid]).trim();
        if (c) return c;
      }
    } catch (e) {
      console.error('[telegram notify] TELEGRAM_NOTIFY_BY_AGENT JSON', e.message);
    }
  }

  const notifyPath = path.join(clientDir(aid), 'notify.json');
  if (fs.existsSync(notifyPath)) {
    try {
      const j = JSON.parse(fs.readFileSync(notifyPath, 'utf8'));
      if (j.telegramChatId != null && String(j.telegramChatId).trim() !== '') {
        return String(j.telegramChatId).trim();
      }
    } catch (e) {
      console.error('[telegram notify] notify.json', notifyPath, e.message);
    }
  }

  return (process.env.TELEGRAM_NOTIFY_CHAT_ID || '').trim();
}

function buildNotifyText(payload) {
  const ag = payload.agentId != null ? String(payload.agentId).trim() : 'default';

  if (payload.kind === 'web_form') {
    const lines = [
      '📬 Заявка с сайта (форма)',
      `Сайт / агент: ${ag || 'default'}`,
      `Источник: ${payload.source || 'web'}`,
      `Имя: ${payload.name || '—'}`,
      `Контакт: ${payload.contact || '—'}`,
    ];
    if (payload.task) lines.push(`Задача: ${payload.task}`);
    if (payload.leadId != null) lines.push(`leadId: ${payload.leadId}`);
    return lines.join('\n');
  }

  const lines = [
    '💬 Контакт из чата (виджет / Telegram)',
    `Сайт / агент: ${ag || 'default'}`,
    `Источник: ${payload.source}`,
    `userId: ${payload.externalUserId}`,
    `Контакт: ${payload.contact}`,
  ];
  if (payload.leadId != null) lines.push(`leadId: ${payload.leadId}`);
  return lines.join('\n');
}

export function notifyLeadSavedAsync(payload) {
  const token = (process.env.TELEGRAM_NOTIFY_BOT_TOKEN || '').trim();
  const agentId = payload.agentId != null && String(payload.agentId).trim()
    ? String(payload.agentId).trim()
    : 'default';
  const chatId = resolveNotifyChatId(agentId);
  if (!token || !chatId) return;

  const text = buildNotifyText({ ...payload, agentId });

  setImmediate(() => {
    fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
    }).catch((e) => console.error('[telegram notify]', e.message));
  });
}
