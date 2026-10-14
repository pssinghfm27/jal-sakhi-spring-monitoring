#!/bin/bash
# SPDX-License-Identifier: MIT
# Quick reference for Jal Sakhi Docker commands

echo "🐳 Jal Sakhi Docker Commands Reference"
echo "======================================"
echo ""

echo "📋 Build & Deployment"
echo "  docker-compose build                 # Build all images"
echo "  docker-compose up -d                 # Start all services"
echo "  docker-compose down                  # Stop all services"
echo "  docker-compose restart               # Restart all services"
echo ""

echo "📊 View Status"
echo "  docker-compose ps                    # Show running services"
echo "  docker-compose logs -f               # Show all logs (live)"
echo "  docker-compose logs -f backend       # Show backend logs"
echo "  docker-compose logs -f web-dashboard  # Show dashboard logs"
echo "  docker-compose logs -f postgres      # Show database logs"
echo ""

echo "🗄️  Database"
echo "  docker-compose exec postgres psql -U chirag -d jalsakhi"
echo "  docker-compose exec backend npm run migrate"
echo "  docker-compose exec backend npm run seed"
echo ""

echo "🔍 Debugging"
echo "  docker-compose exec backend /bin/sh  # SSH into backend"
echo "  docker-compose exec postgres /bin/sh # SSH into database"
echo "  docker-compose exec web-dashboard /bin/sh # SSH into dashboard"
echo ""

echo "🧹 Cleanup"
echo "  docker-compose down -v               # Stop & remove volumes (⚠️ deletes data)"
echo "  docker system prune                  # Remove unused images/volumes"
echo "  docker system prune -a --volumes     # Full cleanup"
echo ""

echo "📝 Check configuration"
echo "  docker-compose config                # Validate docker-compose.yml"
echo ""

echo "For full documentation, see DEPLOYMENT.md"
