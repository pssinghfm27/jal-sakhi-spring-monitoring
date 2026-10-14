#!/bin/bash
# SPDX-License-Identifier: MIT
# Deploy script for Jal Sakhi on Linux server

set -e

echo "🚀 Jal Sakhi Deployment Script"
echo "=============================="

# Check Docker installation
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    echo "✅ Docker installed. You may need to log out and back in."
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose not found. Installing..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    echo "✅ Docker Compose installed."
fi

# Create necessary directories
mkdir -p backend/uploads

echo "📦 Building Docker images..."
docker-compose build --no-cache

echo "🔄 Starting services..."
docker-compose up -d

echo "⏳ Waiting for database to initialize..."
sleep 10

echo "🗄️  Running database migrations..."
docker-compose exec -T backend npm run migrate

echo "🌱 Seeding database (optional)..."
docker-compose exec -T backend npm run seed || true

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Web Dashboard: http://<SERVER_IP>"
echo "🔌 Backend API:   http://<SERVER_IP>/api"
echo "📖 API Docs:      http://<SERVER_IP>/docs"
echo ""
echo "🐳 Useful Docker commands:"
echo "  docker-compose logs -f backend      # Backend logs"
echo "  docker-compose logs -f web-dashboard  # Dashboard logs"
echo "  docker-compose logs -f postgres     # Database logs"
echo "  docker-compose ps                   # Show running services"
echo "  docker-compose down                 # Stop all services"
echo ""
