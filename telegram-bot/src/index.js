import dotenv from 'dotenv';
dotenv.config();
import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';

const token = process.env.TELEGRAM_BOT_TOKEN;
const backendUrl = (process.env.BACKEND_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const agentId = process.env.AGENT_ID || 'default';
const apiKey = process.env.BACKEND_API_KEY || '';

if (!token) {
  console.error('Set TELEGRAM_BOT_TOKEN in .env');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

async function sendToBackend(chatId, text) {
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['X-API-Key'] = apiKey;

  const res = await fetch(`${backendUrl}/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message: text,
      userId: String(chatId),
      agentId,
      source: 'telegram',
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.error || res.statusText || 'Backend error';
    throw new Error(msg);
  }
  return data.reply || '';
}

const START_RE = /^\/start(?:@\w+)?(?:\s+.*)?$/i;

function myIdText(chatId) {
  return (
    `Ваш Telegram <b>chat_id</b> в этом чате:\n<code>${chatId}</code>\n\n` +
    'Может понадобиться для настроек на сервере. Команда <code>/myid</code> — показать снова.'
  );
}

bot.onText(START_RE, async (msg) => {
  const chatId = msg.chat.id;
  const name = msg.from?.first_name ? `, ${msg.from.first_name}` : '';
  const body =
    `Здравствуйте${name}!\n\n` +
    'Я консультант студии D-Art: помогаю с вопросами по веб-разработке, Web3 и AI-решениям. ' +
    'Могу кратко рассказать об услугах, подобрать формат работы и при необходимости собрать заявку (имя, контакт, задача).\n\n' +
    'Напишите сообщение — отвечу здесь в чате.\n\n' +
    '────────\n' +
    myIdText(chatId);
  try {
    await bot.sendMessage(chatId, body, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: '📋 Мой ID', callback_data: 'd_art_cw_show_id' }]],
      },
    });
  } catch (e) {
    console.error(e);
    await bot.sendMessage(
      chatId,
      `Здравствуйте${name}!\n\n` +
        'Я консультант студии D-Art: … (напишите сообщение)…'
    );
  }
});

bot.onText(/^\/(myid|id)(?:@\w+)?(?:\s|$)/i, async (msg) => {
  try {
    await bot.sendMessage(msg.chat.id, myIdText(msg.chat.id), { parse_mode: 'HTML' });
  } catch (e) {
    console.error(e);
  }
});

bot.on('callback_query', async (q) => {
  if (q.data !== 'd_art_cw_show_id' || !q.message) return;
  const chatId = q.message.chat.id;
  try {
    await bot.answerCallbackQuery(q.id, { text: 'Готово' });
    await bot.sendMessage(chatId, myIdText(chatId), { parse_mode: 'HTML' });
  } catch (e) {
    console.error(e);
  }
});

bot.on('message', async (msg) => {
  const t = msg.text || '';
  if (t.startsWith('/') && START_RE.test(t.trim())) return;
  if (msg.text && msg.text.startsWith('/')) {
    if (/^\/(myid|id)(?:@\w+)?(?:\s|$)/i.test(msg.text.trim())) return;
    return;
  }

  const text = msg.text || msg.caption;
  if (!text || !String(text).trim()) {
    await bot.sendMessage(msg.chat.id, 'Пока умею отвечать на текстовые сообщения. Напишите вопрос текстом.');
    return;
  }

  try {
    await bot.sendChatAction(msg.chat.id, 'typing');
    const reply = await sendToBackend(msg.chat.id, String(text).trim());
    await bot.sendMessage(msg.chat.id, reply || '…', { disable_web_page_preview: true });
  } catch (e) {
    console.error(e);
    await bot.sendMessage(
      msg.chat.id,
      'Сейчас не удалось получить ответ. Попробуйте чуть позже или напишите нам в Telegram из сайта.'
    );
  }
});

console.log('Telegram bot polling… backend:', backendUrl);
