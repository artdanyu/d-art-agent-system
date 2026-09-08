#!/usr/bin/env bash
# Обновление бекенда на сервере после git pull.
# Запуск: sudo -u www-data bash scripts/server-update.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="$ROOT/backend"

echo "==> agent_system update in $ROOT"

cd "$ROOT"
git pull --ff-only

cd "$BACKEND"
npm ci --omit=dev 2>/dev/null || npm install --omit=dev

if systemctl is-active --quiet d-art-backend; then
  echo "==> restarting d-art-backend"
  sudo systemctl restart d-art-backend
  sleep 1
  systemctl is-active d-art-backend
  curl -sf http://127.0.0.1:3000/health && echo " health OK"
else
  echo "==> d-art-backend not running; start manually:"
  echo "    sudo systemctl start d-art-backend"
fi

echo "==> done"
