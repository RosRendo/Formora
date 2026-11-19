# Skemat SaaS Production Deployment Guide

This guide covers production deployment for **Skemat (Blueprint OS)** (`skemat.online`) as a high-performance, single-container full-stack SaaS application.

---

## 1. System Architecture

Skemat runs as a unified, high-efficiency Node.js application:
* **Frontend:** React 19 + Tailwind CSS + Lucide icons pre-compiled with Vite into static assets (`dist/`).
* **Backend:** Node.js 22+ Express API serving both JSON endpoints under `/api/*` and the static SPA bundle for all other routes.
* **Database:** Embedded relational SQLite in **WAL (Write-Ahead-Log)** mode via Node's native `node:sqlite` (`server/data/skemat.sqlite`). Zero external database servers required.
* **Billing:** Paddle Billing v2 (`paddle.com`) Merchant of Record with HMAC-SHA256 signature verification, automated subscription lifecycle, and customer portal.
* **AI Engine:** Universal Server AI router supporting OpenRouter, Gemini 2.5, DeepSeek V3, Groq, Anthropic, or OpenAI.

---

## 2. Production Environment Variables Checklist

Before starting, copy `.env.example` to `.env` or set these in your hosting provider's dashboard:

```env
# Server Runtime
NODE_ENV=production
PORT=3001

# Security (CRITICAL: Must be >= 32 random characters in production)
JWT_SECRET=generate-a-strong-random-64-character-secret-key-here
CORS_ORIGIN=https://skemat.online,https://app.skemat.online
FRONTEND_URL=https://skemat.online

# Persistent Database Path
DATABASE_PATH=/app/server/data/skemat.sqlite

# Paddle Billing v2 (paddle.com Merchant of Record)
BILLING_PROVIDER=paddle
PADDLE_ENV=production
PADDLE_API_KEY=pdl_api_...
PADDLE_CLIENT_TOKEN=live_...
PADDLE_WEBHOOK_SECRET_KEY=pdl_ntfset_...
PADDLE_PRO_MONTHLY_PRICE_ID=pri_...
PADDLE_PRO_YEARLY_PRICE_ID=pri_...
PADDLE_TEAM_MONTHLY_PRICE_ID=pri_...
PADDLE_TEAM_YEARLY_PRICE_ID=pri_...

# Server-Managed AI Architect (Universal SaaS Default)
AI_PROVIDER=openrouter
AI_MODEL=anthropic/claude-3.5-sonnet
AI_API_KEY=sk-or-v1-...
ALLOW_USER_LLM_CONFIG=true
ALLOW_LOCAL_LLM_ENDPOINTS=false
```

---

## 3. Deployment Option A: Docker & Docker Compose (Recommended)

Skemat includes a production-ready multi-stage `Dockerfile` and `docker-compose.yml`.

### Quick Start:
```bash
# 1. Build and start in detached mode
docker compose up -d --build

# 2. Check logs
docker compose logs -f skemat

# 3. Verify healthcheck
curl http://localhost:3001/api/health
```

### Volume Persistence:
SQLite data is stored in the Docker volume `skemat_data` mounted at `/app/server/data`. Your database will persist across container rebuilds and image updates.

---

## 4. Deployment Option B: Bare VPS (Ubuntu / Debian with PM2 & Nginx)

### Prerequisites:
* Ubuntu 22.04 or 24.04 LTS
* Node.js v22.x or later:
  ```bash
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs nginx certbot python3-certbot-nginx
  sudo npm install -g pm2
  ```

### Build & Run with PM2:
```bash
# 1. Clone repository
git clone https://github.com/your-username/skemat.git /var/www/skemat
cd /var/www/skemat

# 2. Install dependencies & build frontend bundle
npm ci
npm run build

# 3. Configure production environment
cp .env.example .env
nano .env

# 4. Start with PM2
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup
```

### Nginx Configuration (`/etc/nginx/sites-available/skemat`):
```nginx
server {
    server_name skemat.online app.skemat.online;

    client_max_body_size 25M;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable site & obtain free SSL certificate:
```bash
sudo ln -s /etc/nginx/sites-available/skemat /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d skemat.online -d app.skemat.online
```

---

## 5. Deployment Option C: Railway / Render / Fly.io (PaaS)

Skemat is 100% compatible with modern PaaS platforms:
1. Connect your GitHub repository to Railway or Render.
2. Set **Build Command:** `npm run build`
3. Set **Start Command:** `npm start` (runs `node server/server.js`)
4. Add a **Persistent Disk** mounted at `/app/server/data` (or set `DATABASE_PATH` to the mounted volume path).
5. Paste your environment variables into the dashboard.

---

## 6. Paddle Billing Setup Checklist (paddle.com)

1. **Create Products & Prices on Paddle:**
   * Go to **Catalog &rarr; Products** in your Paddle Dashboard (Sandbox or Production).
   * Create two products:
     - **Pro Builder**: Add a monthly price ($19/mo) and an annual price ($190/yr). Note the Price IDs (`pri_...`).
     - **Team Studio**: Add a monthly price ($49/mo) and an annual price ($490/yr). Note the Price IDs (`pri_...`).
2. **Configure Webhook Notifications:**
   * Go to **Developer Tools &rarr; Notifications**.
   * Click **New destination** &rarr; Webhook.
   * Set **URL:** `https://formora-production-6e4631df.up.railway.app/api/billing/webhook/paddle` (or `https://skemat.online/api/billing/webhook/paddle`).
   * Select events:
     - `subscription.activated`
     - `subscription.updated`
     - `subscription.canceled`
     - `subscription.past_due`
     - `subscription.resumed`
     - `transaction.completed`
     - `transaction.paid`
   * Copy the **Secret Key** (`pdl_ntfset_...`) into `PADDLE_WEBHOOK_SECRET_KEY`.
3. **Generate API Keys & Client Token:**
   * Go to **Developer Tools &rarr; Authentication**.
   * Generate an **API key** (`pdl_api_...`) with permissions for `transactions` and `subscriptions`.
   * Copy your **Client token** (`live_...` or `test_...`).
4. **Update Environment Variables:**
   * In Railway (or your server `.env`):
     - `BILLING_PROVIDER=paddle`
     - `PADDLE_ENV=production` (or `sandbox` for testing)
     - `PADDLE_API_KEY=pdl_api_...`
     - `PADDLE_CLIENT_TOKEN=live_...`
     - `PADDLE_WEBHOOK_SECRET_KEY=pdl_ntfset_...`
     - `PADDLE_PRO_MONTHLY_PRICE_ID=pri_...`
     - `PADDLE_PRO_YEARLY_PRICE_ID=pri_...`
     - `PADDLE_TEAM_MONTHLY_PRICE_ID=pri_...`
     - `PADDLE_TEAM_YEARLY_PRICE_ID=pri_...`

---

## 7. Automated SQLite Database Backups

Because SQLite is running in WAL mode, you can safely create online hot backups without stopping the server using a daily cron job:

```bash
# /etc/cron.daily/skemat-backup
#!/bin/bash
BACKUP_DIR="/var/backups/skemat"
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
# Safe SQLite vacuum backup
sqlite3 /var/www/skemat/server/data/skemat.sqlite ".backup '$BACKUP_DIR/skemat_$TIMESTAMP.sqlite'"
# Keep last 14 days of backups
find "$BACKUP_DIR" -type f -name "*.sqlite" -mtime +14 -delete
```
Make executable: `sudo chmod +x /etc/cron.daily/skemat-backup`
