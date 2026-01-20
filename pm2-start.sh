#!/bin/bash

# =============================================
# SkinAura Pro - PM2 Start Script
# =============================================

set -e

echo "🚀 SkinAura Pro - PM2 Deployment"
echo "================================="

# Navigate to project root
cd "$(dirname "$0")"

# Create logs directory
mkdir -p logs

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2 not found. Installing globally..."
    npm install -g pm2
fi

# Build Backend
echo ""
echo "📦 Building Backend..."
cd backend
npm install --production=false
npm run build
cd ..

# Build Frontend
echo ""
echo "📦 Building Frontend..."
cd frontend
npm install --production=false
npm run build
cd ..

# Stop existing PM2 processes (if any)
echo ""
echo "🛑 Stopping existing processes..."
pm2 delete ecosystem.config.cjs 2>/dev/null || true

# Kill any processes on the ports (to avoid EADDRINUSE)
echo "🔌 Freeing up ports 3000 and 8080..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:8080 | xargs kill -9 2>/dev/null || true
sleep 1

# Start with PM2
echo ""
echo "✅ Starting services with PM2..."
pm2 start ecosystem.config.cjs

# Show status
echo ""
echo "📊 PM2 Status:"
pm2 status

# Save PM2 process list (for auto-restart on reboot)
pm2 save

echo ""
echo "================================="
echo "✅ SkinAura Pro is running!"
echo ""
echo "🔗 Frontend: http://localhost:8080"
echo "🔗 Backend:  http://localhost:3000"
echo ""
echo "📋 Useful PM2 Commands:"
echo "   pm2 status           - Check status"
echo "   pm2 logs             - View logs"
echo "   pm2 logs --lines 50  - View last 50 log lines"
echo "   pm2 restart all      - Restart all services"
echo "   pm2 stop all         - Stop all services"
echo "   pm2 monit            - Real-time monitoring"
echo "================================="
