# agent_system — бекенд AI-виджетов D-Art

Единый Node.js API для чат-виджетов на сайтах клиентов.

- **API:** `/health`, `/chat`, `/lead`
- **Клиенты:** папки в `backend/clients/` → `data-agent-id` на сайте
- **Сайты:** d-art.space (`default`), prostranstvo.pw (`prostranstvo`), и др.

Виджет на сайте вызывает `https://d-art.space/api/chat` — nginx проксирует на этот сервис.

## Быстрый старт (локально)

```bash
cd backend
cp .env.example .env   # заполнить DEEPSEEK_API_KEY и др.
npm install
npm start
curl http://127.0.0.1:3000/health
```

## Деплой на сервер через Git

См. [DEPLOY-SERVER.md](./DEPLOY-SERVER.md) и [scripts/server-update.sh](./scripts/server-update.sh).

На сервере рекомендуемый путь:

```
/var/www/d-art/agent_system/
```

Рядом со статикой d-art.space в `/var/www/d-art/`.

## Добавить клиента

См. `backend/clients/HOWTO.txt` — скопировать `_template` → новая папка → `data-agent-id` в виджете.

## Секреты

`.env` в `backend/` и `telegram-bot/` **не коммитятся**. На сервере создаётся вручную один раз.
