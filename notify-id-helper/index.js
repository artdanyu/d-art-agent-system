/**
 * Мини-бот на том же TELEGRAM_NOTIFY_BOT_TOKEN, что и уведомления с бекенда.
 * Клиент нажимает /start — видит свой chat_id для notify.json / TELEGRAM_NOTIFY_BY_AGENT.
 *
 * Запуск (токен читается из ../backend/.env):
 *   cd notify-id-helper && npm i && npm start
 *
 * Важно: не запускайте два polling на одном токене. Если этот процесс работает,
 * бекенд всё равно шлёт сообщения через HTTP API — конфликта нет.
 * Если у вас уже крутится другой polling на этом токене — остановите его или объедините логику.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import TelegramBot from 'node-telegram-bot-api';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', 'backend', '.env') });
dotenv.config();

const token = (process.env.TELEGRAM_NOTIFY_BOT_TOKEN || '').trim();
if (!token) {
  console.error('Укажите TELEGRAM_NOTIFY_BOT_TOKEN в agent_system/backend/.env');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

function buildIdText(chatId) {
  return (
    'Бот уведомлений D-Art. Сюда приходят заявки, если в настройках бекенда указан <b>ваш</b> chat_id.\n\n' +
    'Ваш <b>chat_id</b> (для <code>notify.json</code> / <code>TELEGRAM_NOTIFY_BY_AGENT</code>):\n' +
    `<code>${chatId}</code>\n\n` +
    'Скопируйте число как есть. После /start боту уведомлений настройка заработает для этого чата.'
  );
}

const START_RE = /^\/start(?:@\w+)?(?:\s+.*)?$/i;

bot.onText(START_RE, async (msg) => {
  const chatId = msg.chat.id;
  try {
    await bot.sendMessage(chatId, buildIdText(chatId), {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📋 Показать ID ещё раз', callback_data: 'd_art_show_id' }],
        ],
      },
    });
  } catch (e) {
    console.error(e);
  }
});

bot.onText(/^\/(myid|id)(?:@\w+)?(?:\s|$)/i, async (msg) => {
  const chatId = msg.chat.id;
  try {
    await bot.sendMessage(chatId, buildIdText(chatId), { parse_mode: 'HTML' });
  } catch (e) {
    console.error(e);
  }
});

bot.on('callback_query', async (q) => {
  if (q.data !== 'd_art_show_id' || !q.message) return;
  const chatId = q.message.chat.id;
  try {
    await bot.answerCallbackQuery(q.id, { text: `ID: ${chatId}` });
    await bot.sendMessage(chatId, buildIdText(chatId), { parse_mode: 'HTML' });
  } catch (e) {
    console.error(e);
  }
});

console.log('D-Art notify id-helper polling… (TELEGRAM_NOTIFY_BOT_TOKEN)');
