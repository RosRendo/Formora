# Formora SaaS Production Deployment Guide

This guide covers production deployment for **Formora (Blueprint OS)** as a high-performance, single-container full-stack SaaS application.

---

## 1. System Architecture

Formora runs as a unified, high-efficiency Node.js application:
* **Frontend:** React 19 + Tailwind CSS + Lucide icons pre-compiled with Vite into static assets (`dist/`).
* **Backend:** Node.js 22+ Express API serving both JSON endpoints under `/api/*` and the static SPA bundle for all other routes.
* **Database:** Embedded relational SQLite in **WAL (Write-Ahead-Log)** mode via Node's native `node:sqlite` (`server/data/formora.sqlite`). Zero external database servers required.
* **Billing:** Lemon Squeezy Merchant-of-Record with dual-layer redundancy (HMAC-SHA256 Webhook push + Direct API fallback pull).
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
CORS_ORIGIN=https://app.formora.dev
FRONTEND_URL=https://app.formora.dev

# Persistent Database Path
DATABASE_PATH=/app/server/data/formora.sqlite

# Lemon Squeezy Merchant-of-Record Billing
LEMONSQUEEZY_API_KEY=your_live_api_key
LEMONSQUEEZY_STORE_ID=your_store_id
LEMONSQUEEZY_WEBHOOK_SECRET=your_custom_webhook_secret
LEMONSQUEEZY_PRO_MONTHLY_VARIANT_ID=2350645
LEMONSQUEEZY_PRO_YEARLY_VARIANT_ID=2350664
LEMONSQUEEZY_TEAM_MONTHLY_VARIANT_ID=2350686
LEMONSQUEEZY_TEAM_YEARLY_VARIANT_ID=2350677

# Server-Managed AI Architect (Universal SaaS Default)
AI_PROVIDER=openrouter
AI_MODEL=anthropic/claude-3.5-sonnet
AI_API_KEY=sk-or-v1-...
ALLOW_USER_LLM_CONFIG=true
ALLOW_LOCAL_LLM_ENDPOINTS=false
```

---

## 3. Deployment Option A: Docker & Docker Compose (Recommended)

Formora includes a production-ready multi-stage `Dockerfile` and `docker-compose.yml`.

### Quick Start:
```bash
# 1. Build and start in detached mode
docker compose up -d --build

# 2. Check logs
docker compose logs -f formora

# 3. Verify healthcheck
curl http://localhost:3001/api/health
```

### Volume Persistence:
SQLite data is stored in the Docker volume `formora_data` mounted at `/app/server/data`. Your database will persist across container rebuilds and image updates.

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
git clone https://github.com/your-username/formora.git /var/www/formora
cd /var/www/formora

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

### Nginx Configuration (`/etc/nginx/sites-available/formora`):
```nginx
server {
    server_name app.formora.dev;

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
sudo ln -s /etc/nginx/sites-available/formora /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d app.formora.dev
```

---

## 5. Deployment Option C: Railway / Render / Fly.io (PaaS)

Formora is 100% compatible with modern PaaS platforms:
1. Connect your GitHub repository to Railway or Render.
2. Set **Build Command:** `npm run build`
3. Set **Start Command:** `npm start` (runs `node server/server.js`)
4. Add a **Persistent Disk** mounted at `/app/server/data` (or set `DATABASE_PATH` to the mounted volume path).
5. Paste your environment variables into the dashboard.

---

## 6. Lemon Squeezy Live Launch Checklist

1. **Switch to Live Mode:** In Lemon Squeezy dashboard, toggle off **Test Mode**.
2. **Update Webhook URL:**
   * Go to **Settings &rarr; Webhooks**.
   * Set Callback URL: `https://app.formora.dev/api/billing/webhook/lemonsqueezy`
   * Select events: `order_created`, `subscription_created`, `subscription_updated`, `subscription_cancelled`.
3. **Verify Webhook Secret:** Ensure `LEMONSQUEEZY_WEBHOOK_SECRET` matches between your dashboard and server `.env`.

---

## 7. Automated SQLite Database Backups

Because SQLite is running in WAL mode, you can safely create online hot backups without stopping the server using a daily cron job:

```bash
# /etc/cron.daily/formora-backup
#!/bin/bash
BACKUP_DIR="/var/backups/formora"
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
# Safe SQLite vacuum backup
sqlite3 /var/www/formora/server/data/formora.sqlite ".backup '$BACKUP_DIR/formora_$TIMESTAMP.sqlite'"
# Keep last 14 days of backups
find "$BACKUP_DIR" -type f -name "*.sqlite" -mtime +14 -delete
```
Make executable: `sudo chmod +x /etc/cron.daily/formora-backup`

