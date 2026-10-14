# 🚀 COMPLETE STEP-BY-STEP DEPLOYMENT GUIDE

## Overview: What We're Doing

You have three parts that need to work together:
1. **Android APK** (runs on user's phone)
2. **Node.js Backend** (your API server)
3. **React Web Dashboard** (web interface)
4. **PostgreSQL Database** (stores data)

All of this will run inside Docker containers on your Linux server at **<SERVER_IP>:8080**

---

## PART 1: PREPARE YOUR LOCAL MACHINE (MacBook)

### Step 1.1: Verify Your Project Structure

On your MacBook, open Terminal and navigate to your project:

```bash
cd /path/to/your/jal-sakhi-project
ls -la
```

You should see:
```
android/              ← Your Android APK code
backend/              ← Node.js backend (NOT YET running)
web-dashboard/        ← React dashboard (NOT YET running)
docker-compose.yml    ← We created this
deploy.sh             ← We created this
Dockerfile (in backend/)     ← We created this
Dockerfile (in web-dashboard/) ← We created this
```

### Step 1.2: Test Build on MacBook (Optional but Recommended)

Test that Docker builds work before deploying to server:

```bash
# Build the backend image
docker build -t jal-sakhi-backend:latest ./backend

# Build the dashboard image
docker build -t jal-sakhi-dashboard:latest ./web-dashboard
```

If both build successfully, you're ready to deploy.

---

## PART 2: PREPARE YOUR LINUX SERVER (<SERVER_IP>)

### Step 2.1: SSH into Your Server

From your MacBook Terminal:

```bash
ssh user@<SERVER_IP>
```

Replace `user` with your actual username on the server.

**Example:**
```bash
ssh ubuntu@<SERVER_IP>
```

If you use a key file:
```bash
ssh -i /path/to/your/key.pem ubuntu@<SERVER_IP>
```

### Step 2.2: Update System Packages

Once you're logged into the server:

```bash
sudo apt update && sudo apt upgrade -y
```

This ensures your server has the latest security patches.

---

## PART 3: INSTALL DOCKER ON SERVER

### Step 3.1: Check if Docker is Already Installed

```bash
docker --version
docker-compose --version
```

If both commands return version numbers, skip to **PART 4**.

### Step 3.2: Install Docker

If Docker is NOT installed, run:

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

### Step 3.3: Add User to Docker Group

This allows you to run Docker commands without `sudo`:

```bash
sudo usermod -aG docker $USER
```

Then log out and log back in:

```bash
exit
# Wait a moment, then SSH back in
ssh user@<SERVER_IP>
```

### Step 3.4: Verify Docker Installation

```bash
docker run hello-world
```

You should see: "Hello from Docker!"

---

## PART 4: TRANSFER YOUR PROJECT TO SERVER

### Option A: Using Git (Recommended)

If your project is on GitHub/GitLab:

```bash
cd ~
git clone https://github.com/YOUR-USERNAME/jal-sakhi.git
cd jal-sakhi
```

### Option B: Using SCP (If No Git)

From your MacBook:

```bash
scp -r /path/to/jal-sakhi user@<SERVER_IP>:~/jal-sakhi
```

Then on server:
```bash
cd ~/jal-sakhi
```

### Step 4.1: Verify Files on Server

```bash
ls -la
```

You should see the files we created:
- `backend/Dockerfile`
- `web-dashboard/Dockerfile`
- `docker-compose.yml`
- `deploy.sh`

---

## PART 5: CONFIGURE ENVIRONMENT

### Step 5.1: Check Backend Environment Variables

The backend needs certain environment variables. Edit `docker-compose.yml` on the server:

```bash
nano docker-compose.yml
```

Look for this section:

```yaml
backend:
  environment:
    NODE_ENV: production
    PORT: 8080
    PUBLIC_BASE_URL: http://<SERVER_IP>:8080
    PGHOST: postgres
    PGPORT: 5432
    PGUSER: chirag
    PGPASSWORD: chirag
    PGDATABASE: jalsakhi
    JWT_SECRET: your-super-secret-jwt-key-change-this-in-production
```

**⚠️ IMPORTANT CHANGES FOR PRODUCTION:**

1. **Change JWT_SECRET** to something random:
   ```bash
   # Generate a random secret (copy the output)
   openssl rand -base64 32
   ```
   Paste the output as your JWT_SECRET

2. **Change PGPASSWORD** to a strong password:
   ```
   PGPASSWORD: YourStrongDatabasePassword123!
   ```

3. Keep everything else as is (or customize if needed)

### Step 5.2: Save and Exit

In `nano`:
- Press `Ctrl + X`
- Press `Y` (yes)
- Press `Enter` (confirm filename)

---

## PART 6: BUILD AND START SERVICES

### Step 6.1: Make Deploy Script Executable

```bash
chmod +x deploy.sh
```

### Step 6.2: Run the Deploy Script

```bash
./deploy.sh
```

This will:
1. ✅ Download Docker images (if needed)
2. ✅ Build the backend image
3. ✅ Build the dashboard image
4. ✅ Start PostgreSQL database
5. ✅ Start Node.js backend
6. ✅ Start React dashboard with Nginx
7. ✅ Run database migrations
8. ✅ Seed database with initial data

**⏱️ This may take 5-10 minutes** depending on internet speed.

### Step 6.3: Monitor the Deployment

In another terminal window (while script is running), check the logs:

```bash
docker-compose logs -f
```

You should see logs from all three services.

---

## PART 7: VERIFY EVERYTHING IS RUNNING

### Step 7.1: Check Running Containers

```bash
docker-compose ps
```

Expected output:
```
NAME                     STATUS              PORTS
jal-sakhi-db            Up 2 minutes        0.0.0.0:5432->5432/tcp
jal-sakhi-backend       Up 2 minutes        127.0.0.1:8080->8080/tcp
jal-sakhi-dashboard     Up 2 minutes        0.0.0.0:8080->80/tcp
```

All three containers should show **"Up"**.

### Step 7.2: Test Backend API

```bash
curl http://localhost:8080/api/health
```

Expected response:
```json
{"ok":true,"time":"2024-01-15T10:30:45.123Z"}
```

### Step 7.3: Test from Your MacBook

In a browser on your MacBook:

```
http://<SERVER_IP>:8080
```

You should see the **React Web Dashboard** load.

---

## PART 8: CONNECT YOUR ANDROID APK

### Step 8.1: Update Your Android App Code

In your Android project, find where you define the API base URL (usually in a `Constants.kt` or `Config.java` file):

**Kotlin Example:**
```kotlin
object Constants {
    const val API_BASE_URL = "http://<SERVER_IP>:8080/api"
}
```

**Java Example:**
```java
public class Config {
    public static final String API_BASE_URL = "http://<SERVER_IP>:8080/api";
}
```

### Step 8.2: Update Network Security (Android 9+)

Create/modify `android/app/src/main/res/xml/network_security_config.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true"><SERVER_IP></domain>
    </domain-config>
</network-security-config>
```

### Step 8.3: Rebuild APK

```bash
# In your android/ directory
./gradlew build
# Or: ./build-apk.sh (if you have this script)
```

### Step 8.4: Install APK on Phone

```bash
adb install app/build/outputs/apk/release/app-release.apk
```

Or manually copy the APK file to your phone.

### Step 8.5: Test Login Flow

1. Open the app on your phone
2. Try to log in with test credentials
3. Check server logs:

```bash
docker-compose logs -f backend
```

You should see API requests in the logs.

---

## PART 9: ACCESS YOUR SERVICES

### From Anywhere (MacBook, Phone, etc.)

#### Web Dashboard
```
http://<SERVER_IP>:8080
```

#### Backend API
```
http://<SERVER_IP>:8080/api
```

#### API Documentation (Swagger)
```
http://<SERVER_IP>:8080/docs
```

#### Health Check
```
http://<SERVER_IP>:8080/api/health
```

---

## PART 10: MONITOR AND MANAGE SERVICES

### View Live Logs

**All services:**
```bash
docker-compose logs -f
```

**Only backend:**
```bash
docker-compose logs -f backend
```

**Only dashboard:**
```bash
docker-compose logs -f web-dashboard
```

**Only database:**
```bash
docker-compose logs -f postgres
```

### Stop Services (Without Deleting Data)

```bash
docker-compose stop
```

### Start Services Again

```bash
docker-compose start
```

### Restart All Services

```bash
docker-compose restart
```

### Completely Remove Everything (⚠️ Deletes All Data)

```bash
docker-compose down -v
```

---

## PART 11: DATABASE OPERATIONS

### Access Database Directly

```bash
docker-compose exec postgres psql -U chirag -d jalsakhi
```

Then you can run SQL commands:
```sql
SELECT * FROM users;
\dt  -- List all tables
\q   -- Exit
```

### Run Migrations Again

```bash
docker-compose exec backend npm run migrate
```

### Seed Database Again

```bash
docker-compose exec backend npm run seed
```

### Backup Database

```bash
docker-compose exec postgres pg_dump -U chirag jalsakhi > backup.sql
```

The backup will be saved as `backup.sql` on your server.

### Restore Database from Backup

```bash
docker-compose exec -T postgres psql -U chirag jalsakhi < backup.sql
```

---

## PART 12: TROUBLESHOOTING

### Problem 1: Containers Won't Start

**Solution:**
```bash
docker-compose logs backend
docker-compose logs postgres
```

Check the error messages and fix accordingly.

### Problem 2: Port 8080 Already in Use

**Solution:** Edit `docker-compose.yml` and change the port:

```yaml
web-dashboard:
  ports:
    - "8081:80"  # Changed from 8080:80 to 8081:80
```

Then restart:
```bash
docker-compose down
docker-compose up -d
```

### Problem 3: APK Can't Connect to Backend

**Check 1: Backend is Running**
```bash
docker-compose ps
```

**Check 2: Firewall Allows Port 8080**
```bash
sudo ufw allow 8080
```

**Check 3: Test Connection from Phone**
Open browser on phone and visit: `http://<SERVER_IP>:8080/api/health`

If page loads, backend is reachable.

### Problem 4: Database Connection Refused

**Solution:**
```bash
docker-compose logs postgres
```

Check if postgres container started successfully.

```bash
# Check Docker network
docker network ls
docker network inspect jal-sakhi-network
```

### Problem 5: Out of Disk Space

**Check:**
```bash
df -h
```

**Clean up Docker:**
```bash
docker system prune -a --volumes
```

---

## PART 13: SECURITY BEST PRACTICES

### Enable Firewall

```bash
sudo ufw enable
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 8080/tcp  # Your app
sudo ufw status
```

### Change Default Passwords

Edit `docker-compose.yml` and change:
- `PGPASSWORD` (database)
- `JWT_SECRET` (authentication)

### Use HTTPS in Production

Set up Let's Encrypt SSL certificate:

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot certonly --standalone -d your-domain.com
```

Then modify Nginx config in `web-dashboard/Dockerfile` to use SSL.

### Restrict Access by IP (If Needed)

In `docker-compose.yml`, add environment variable:

```yaml
backend:
  environment:
    ALLOWED_IPS: "192.168.1.0/24"
```

---

## PART 14: SCALING & OPTIMIZATION

### Increase Resources

If services are slow, increase Docker resources:

```bash
# Check current usage
docker stats
```

Edit `docker-compose.yml`:

```yaml
backend:
  deploy:
    resources:
      limits:
        cpus: '1'
        memory: 512M
      reservations:
        cpus: '0.5'
        memory: 256M
```

### Add Health Checks

Already configured in our Dockerfiles and docker-compose.yml!

Health checks restart containers if they fail.

---

## PART 15: BACKUP STRATEGY

### Automatic Daily Backups

Create a backup script: `backup.sh`

```bash
#!/bin/bash
BACKUP_DIR="$HOME/backups"
mkdir -p $BACKUP_DIR

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/jalsakhi_$TIMESTAMP.sql"

docker-compose exec -T postgres pg_dump -U chirag jalsakhi > $BACKUP_FILE

# Keep only last 7 days of backups
find $BACKUP_DIR -name "jalsakhi_*.sql" -mtime +7 -delete

echo "Backup saved to $BACKUP_FILE"
```

Make it executable:
```bash
chmod +x backup.sh
```

Add to crontab (runs daily at 2 AM):
```bash
crontab -e
# Add this line:
0 2 * * * /home/user/jal-sakhi/backup.sh
```

---

## QUICK REFERENCE

### Most Common Commands

```bash
# Check status
docker-compose ps

# View logs
docker-compose logs -f backend

# Restart
docker-compose restart

# Stop
docker-compose stop

# Start
docker-compose start

# Full restart
docker-compose down && docker-compose up -d

# Database backup
docker-compose exec postgres pg_dump -U chirag jalsakhi > backup.sql
```

---

## FINAL CHECKLIST

- [ ] Docker installed on Linux server
- [ ] Project files transferred to server
- [ ] docker-compose.yml configured with new passwords
- [ ] deploy.sh executed successfully
- [ ] All three containers running (`docker-compose ps`)
- [ ] Backend API responds (`curl http://localhost:8080/api/health`)
- [ ] Web dashboard accessible (`http://<SERVER_IP>:8080`)
- [ ] Android APK updated with backend URL
- [ ] APK can connect and login
- [ ] Firewall allows port 8080
- [ ] Database backed up
- [ ] Monitoring logs working

---

## NEXT STEPS

1. ✅ Complete deployment on server
2. ✅ Test APK login flow
3. ✅ Monitor logs for errors
4. ✅ Set up automated backups
5. ✅ Configure SSL/HTTPS for production
6. ✅ Set up monitoring & alerting

---

## SUPPORT RESOURCES

- Docker Docs: https://docs.docker.com/
- Docker Compose: https://docs.docker.com/compose/
- PostgreSQL: https://www.postgresql.org/docs/
- Node.js: https://nodejs.org/docs/
- React: https://react.dev/

---

**You're all set!** Your app is now running on the server and your APK can connect to it. 🎉
