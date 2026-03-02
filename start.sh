#!/bin/bash

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "🚀 Запуск CRM системы..."
echo ""

# Start backend in background
echo "Starting backend on port 3001..."
(cd "$ROOT/backend" && npm run dev) &
BACKEND_PID=$!

sleep 3

# Start frontend
echo "Starting frontend on port 3000..."
(cd "$ROOT/frontend" && npm run dev) &
FRONTEND_PID=$!

echo ""
echo "═══════════════════════════════════════════"
echo "✅ CRM запущена!"
echo ""
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:3001"
echo ""
echo "   Press Ctrl+C to stop all services"
echo "═══════════════════════════════════════════"

# Wait for Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo ''; echo 'CRM остановлена.'; exit 0" INT TERM

wait
