# Jal Sakhi - Android APK Integration Guide

## Architecture Overview

```
┌──────────────────────────────────────────┐
│       Android APK (Jal Sakhi App)        │
│   Communicates with Backend API          │
└────────────────┬─────────────────────────┘
                 │
          HTTP/HTTPS (8080)
                 │
    ┌────────────┴─────────────┐
    │                          │
    ▼                          ▼
┌─────────────────┐    ┌──────────────────┐
│  Node.js        │    │  Nginx           │
│  Backend API    │    │  + React         │
│  (8080)         │    │  Dashboard       │
└────────┬────────┘    └──────────────────┘
         │
         ▼
    ┌─────────────────┐
    │  PostgreSQL DB  │
    │  (5432)         │
    └─────────────────┘
```

## Android APK Configuration

### API Base URL
Update your Android app to point to:
```
http://<SERVER_IP>:8080/api
```

### Example (Android/Kotlin):
```kotlin
const val API_BASE_URL = "http://<SERVER_IP>:8080/api"
```

### Android Network Security
If using HTTPS in production, ensure your `network_security_config.xml` includes:
```xml
<domain includeSubdomains="true"><SERVER_IP></domain>
```

## Deployment Steps

### 1. On Your Linux Server (<SERVER_IP>)

SSH into your server:
```bash
ssh user@<SERVER_IP>
```

Clone or upload your project:
```bash
git clone <your-repo-url> jal-sakhi
cd jal-sakhi
```

### 2. Install Docker (if not already installed)
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
# Log out and back in for Docker permissions to take effect
```

### 3. Make Deploy Script Executable
```bash
chmod +x deploy.sh
```

### 4. Run Deployment
```bash
./deploy.sh
```

This script will:
- ✅ Build all Docker images
- ✅ Start PostgreSQL database
- ✅ Start Node.js backend
- ✅ Start React web dashboard + Nginx
- ✅ Run database migrations
- ✅ Seed the database

### 5. Verify Services
```bash
docker-compose ps
```

Expected output:
```
CONTAINER ID   IMAGE              PORTS                 STATUS
xxx            jal-sakhi-db       5432/tcp, 0.0.0.0:5432->5432/tcp
xxx            jal-sakhi-backend  0.0.0.0:8080->8080/tcp  
xxx            jal-sakhi-dashboard 0.0.0.0:8080->80/tcp
```

## Access Your Services

- **Web Dashboard**: `http://<SERVER_IP>:8080`
- **Backend API**: `http://<SERVER_IP>:8080/api`
- **API Documentation**: `http://<SERVER_IP>:8080/docs` (Swagger)
- **Health Check**: `http://<SERVER_IP>:8080/api/health`

## Environment Variables

Edit `docker-compose.yml` to configure:

```yaml
backend:
  environment:
    JWT_SECRET: your-super-secret-jwt-key-change-this-in-production
    PGPASSWORD: change-this-password
    PUBLIC_BASE_URL: http://<SERVER_IP>:8080
```

⚠️ **IMPORTANT**: Change these in production!

## Monitoring & Logs

### View Backend Logs
```bash
docker-compose logs -f backend
```

### View Dashboard Logs
```bash
docker-compose logs -f web-dashboard
```

### View Database Logs
```bash
docker-compose logs -f postgres
```

### View All Services
```bash
docker-compose logs -f
```

## Android APK Communication Flow

1. **User logs in via APK**
   - POST `http://<SERVER_IP>:8080/api/auth/login`
   - Backend validates credentials in PostgreSQL

2. **APK stores JWT token**
   - Use token for subsequent requests
   - Include in Authorization header: `Authorization: Bearer <token>`

3. **APK fetches data**
   - GET `http://<SERVER_IP>:8080/api/springs`
   - GET `http://<SERVER_IP>:8080/api/readings`
   - etc.

4. **Web Dashboard uses same backend**
   - Displays real-time data from PostgreSQL
   - Synced with APK data

## Troubleshooting

### Containers won't start
```bash
docker-compose logs backend
docker-compose logs postgres
```

### Database connection refused
- Check `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD` in docker-compose.yml
- Ensure postgres container is healthy: `docker-compose ps`

### APK can't reach backend
- Check firewall: `sudo ufw allow 8080`
- Verify server IP and port: `curl http://<SERVER_IP>:8080/api/health`

### Port 8080 already in use
```bash
# Change port in docker-compose.yml
ports:
  - "8081:80"  # Map to 8081 instead
```

## Stopping & Removing Services

### Stop without removing data
```bash
docker-compose stop
```

### Start again
```bash
docker-compose start
```

### Remove everything (⚠️ deletes data)
```bash
docker-compose down -v
```

## Database Backup

Backup PostgreSQL data:
```bash
docker-compose exec postgres pg_dump -U chirag jalsakhi > backup.sql
```

Restore from backup:
```bash
docker-compose exec -T postgres psql -U chirag jalsakhi < backup.sql
```

## Security Recommendations

1. **Change default passwords** in docker-compose.yml
2. **Use HTTPS** in production (add SSL certificate to Nginx)
3. **Enable firewall**: `sudo ufw enable && sudo ufw allow 8080`
4. **Restrict API access** by IP if needed
5. **Use strong JWT_SECRET** (minimum 32 characters)
6. **Disable file uploads** if not needed
7. **Run containers as non-root** (already configured)

## Production Deployment

For production, consider:
- Use managed PostgreSQL (AWS RDS, Azure Database)
- Add SSL/TLS certificates (Let's Encrypt)
- Set up load balancing
- Enable monitoring & alerting
- Use Docker Compose only for single-host deployments; consider Kubernetes for multi-node
- Set up automated backups
- Use environment-specific .env files

## Next Steps

1. Deploy to your Linux server using `deploy.sh`
2. Update Android APK with backend URL: `http://<SERVER_IP>:8080/api`
3. Test APK connection to backend
4. Access web dashboard at `http://<SERVER_IP>:8080`
5. Monitor logs and verify all services are running

Questions? Check Docker Compose documentation: https://docs.docker.com/compose/
