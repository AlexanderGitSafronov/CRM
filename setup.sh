#!/bin/bash

set -e

echo "🚀 Установка CRM системы..."
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js не установлен. Установите Node.js 18+ с https://nodejs.org"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Требуется Node.js 18+. Текущая версия: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v)"

# Backend setup
echo ""
echo "📦 Установка backend зависимостей..."
cd backend
npm install

echo "🗄️ Инициализация базы данных..."
npx prisma generate
npx prisma migrate dev --name init
npm run db:seed

echo "✅ Backend готов"

# Frontend setup
echo ""
echo "📦 Установка frontend зависимостей..."
cd ../frontend
npm install

echo "✅ Frontend готов"

echo ""
echo "═══════════════════════════════════════════"
echo "✅ Установка завершена!"
echo ""
echo "🔑 Тестовые аккаунты:"
echo "   Администратор: admin@crm.com    / admin123"
echo "   Менеджер:      manager1@crm.com / manager123"
echo "   Просмотр:      viewer@crm.com   / viewer123"
echo ""
echo "🚀 Для запуска:"
echo "   ./start.sh"
echo ""
echo "   Или вручную:"
echo "   Terminal 1: cd backend && npm run dev"
echo "   Terminal 2: cd frontend && npm run dev"
echo ""
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:3001"
echo "═══════════════════════════════════════════"
