# Деплой agent_system через Git

Бекенд виджетов — **один сервис** для d-art.space, prostranstvo.pw и других клиентов.

## Сервер D-Art (ваша схема)

```
/var/www/
├── d-art/                  # статика d-art.space
│   └── agent_system/       # ← git clone бекенда сюда
├── prostranstvo.pw/        # лендинг (git отдельно)
├── app.prostranstvo.pw/    # приложение
└── space-tg/

/etc/nginx/sites-enabled/
├── d-art.space             # + proxy /api/ → :3000
├── prostranstvo.pw
└── app.prostranstvo.pw
```

---

## 1. Создать репозиторий (один раз, на ПК)

```powershell
cd D:\cursor\d-art-s\agent_system
git init -b main
git add .
git commit -m "Initial commit: AI widget backend"
```

GitHub (пример):

```powershell
gh repo create d-art-agent-system --private --source=. --remote=origin --push
```

Или вручную: создать пустой репозиторий на GitHub → `git remote add origin ...` → `git push -u origin main`.

**Не коммитить:** `.env`, `notify.json`, `node_modules`, `data/`.

---

## 2. Первый деплой на сервер

```bash
ssh root@D-Art

# каталог под бекенд (рядом со статикой d-art)
mkdir -p /var/www/d-art
cd /var/www/d-art

git clone git@github.com:ВАШ_ЛОГИН/d-art-agent-system.git agent_system
cd agent_system/backend

cp .env.example .env
nano .env
```

Минимум `.env`:

```env
PORT=3000
BIND_ADDRESS=127.0.0.1
NODE_ENV=production
DEEPSEEK_API_KEY=sk-...
CORS_ORIGIN=https://d-art.space,https://www.d-art.space,https://prostranstvo.pw,https://www.prostranstvo.pw
TRUST_PROXY=1
ALLOW_ANONYMOUS_ACCESS=1
TELEGRAM_NOTIFY_BOT_TOKEN=...
TELEGRAM_NOTIFY_CHAT_ID=...
# отдельный чат для prostranstvo.pw (опционально):
# TELEGRAM_NOTIFY_BY_AGENT={"prostranstvo":"CHAT_ID","default":"589807721"}
```

Нужен **Node 20+** (`node -v`). На сервере уже v20 — подходит.

```bash
npm install
node src/index.js
# Ctrl+C после проверки
curl http://127.0.0.1:3000/health
```

### systemd

```bash
cp /var/www/d-art/agent_system/deploy/d-art-backend.service.example \
   /etc/systemd/system/d-art-backend.service

systemctl daemon-reload
systemctl enable --now d-art-backend
systemctl status d-art-backend
```

Пути в service-файле уже: `/var/www/d-art/agent_system/backend`.

### nginx (d-art.space)

Добавить блок из `deploy/nginx-api-snippet.conf` в конфиг `d-art.space`, затем:

```bash
nginx -t && systemctl reload nginx
curl https://d-art.space/health
curl -X POST https://d-art.space/api/chat \
  -H "Content-Type: application/json" \
  -d '{"agentId":"prostranstvo","message":"Как начать?","source":"web"}'
```

### Уведомления prostranstvo

```bash
cp backend/clients/prostranstvo/notify.json.example \
   backend/clients/prostranstvo/notify.json
nano backend/clients/prostranstvo/notify.json
systemctl restart d-art-backend
```

Подробнее: `backend/clients/prostranstvo/NOTIFY.txt`.

---

## 3. Обновления (каждый релиз)

**На ПК:**

```powershell
cd D:\cursor\d-art-s\agent_system
git add .
git commit -m "Описание изменений"
git push
```

**На сервере:**

```bash
cd /var/www/d-art/agent_system
bash scripts/server-update.sh
```

Скрипт делает `git pull`, `npm install`, `systemctl restart d-art-backend`.

---

## Клиенты (agentId)

| Сайт | data-agent-id | Папка |
|------|---------------|-------|
| d-art.space | default | `clients/dart-art/` |
| prostranstvo.pw | prostranstvo | `clients/prostranstvo/` |
| 123okna | 123okna | `clients/123okna/` |

После изменения `system.md` / `knowledge.json` — restart бекенда.

---

## Проверка виджета prostranstvo.pw

1. https://prostranstvo.pw — кнопка чата
2. DevTools → Network → `POST https://d-art.space/api/chat` → 200
3. Вопрос: «Какие тарифы?» / «Как открыть приложение?»

---

## Troubleshooting

| Симптом | Что проверить |
|---------|----------------|
| CORS error в браузере | `prostranstvo.pw` в `CORS_ORIGIN` |
| 502 на /api/chat | `systemctl status d-art-backend`, порт 3000 |
| Агент не знает тарифы | `ls clients/prostranstvo/`, restart |
| Нет TG-уведомлений | `notify.json` или `TELEGRAM_NOTIFY_BY_AGENT`, токен бота |
