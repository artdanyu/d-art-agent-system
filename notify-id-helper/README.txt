D-Art: бот «узнай свой chat_id» для настройки уведомлений
===========================================================

Запуск (читает backend/.env):

  cd agent_system/notify-id-helper
  npm install
  npm start

Переменная: TELEGRAM_NOTIFY_BOT_TOKEN (тот же, что в бекенде).

Команды: /start, /myid, кнопка «Показать ID ещё раз».

В production — systemd / pm2 на том же сервере, что и бекенд.

Важно: на одном TELEGRAM_NOTIFY_BOT_TOKEN не должно быть двух процессов с polling
(например, этот helper и ещё что-то). Бекенд шлёт сообщения через API и polling не использует — конфликта с helper нет.

409 Conflict в логах — кто-то ещё подключил getUpdates к этому боту; оставьте один polling-процесс.
