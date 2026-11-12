# Hostinger VPS KVM 4 Deployment Guide: Arab Season ERP

Complete step-by-step production deployment guide tailored specifically for **Hostinger VPS KVM 4** (4 vCPU, 16 GB RAM, 200 GB NVMe, Ubuntu 22.04 / 24.04 LTS).

---

## Architecture Overview

```
                      [ Client Browsers / Mobile ]
                                   │
                                   │ HTTPS (Port 443 - SSL by Let's Encrypt)
                                   ▼
                       [ Nginx Reverse Proxy ]
                        /var/www/erp/frontend/dist
                                   │
         ┌─────────────────────────┴─────────────────────────┐
         │                                                   │
  /assets/ & /                      /api/ & /admin/       /static/
  (Static React Frontend)     (Reverse Proxy to Gunicorn) (Django Admin Static)
                                         │
                                         ▼
                            [ Gunicorn WSGI Server ]
                            (127.0.0.1:8000 - 9 workers)
                                         │
                                         ▼
                           [ PostgreSQL 16 Database ]
                               (Local unix socket)
```

---

## Pre-requisites & Checklist

1. **Hostinger VPS**: KVM 4 instance running **Ubuntu 22.04 LTS** or **Ubuntu 24.04 LTS**.
2. **VPS Credentials**: Root IP address and password / SSH key from your Hostinger hPanel.
3. **Domain Name**: e.g., `erp.arabseason.info` with an **A Record** pointing to your Hostinger VPS IPv4.

---

## Step 1: Connect to VPS via SSH

From your local terminal (PowerShell, macOS Terminal, or Linux):

```bash
ssh root@YOUR_HOSTINGER_VPS_IP
```

---

## Step 2: System Update & Dependencies

Run the automated setup script or execute the commands manually:

```bash
# Update repositories
apt update && apt upgrade -y

# Install Python, build tools, PostgreSQL, Nginx, Git, UFW
apt install -y python3 python3-pip python3-venv python3-dev \
    build-essential libpq-dev nginx git curl ufw fail2ban \
    postgresql postgresql-contrib certbot python3-certbot-nginx

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Configure Firewall
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
```

---

## Step 3: Set Up PostgreSQL Database

Log in to PostgreSQL and create the database and user:

```bash
sudo -u postgres psql
```

Inside the PostgreSQL prompt (`postgres=#`), run:

```sql
CREATE DATABASE erp_db;
CREATE USER erp_user WITH PASSWORD 'ChooseAStrongPassword123!';
ALTER ROLE erp_user SET client_encoding TO 'utf8';
ALTER ROLE erp_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE erp_user SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE erp_db TO erp_user;
ALTER DATABASE erp_db OWNER TO erp_user;
\q
```

---

## Step 4: Clone / Upload Your Codebase

Create the project directory at `/var/www/erp`:

```bash
mkdir -p /var/www/erp
chown -R $USER:$USER /var/www/erp
cd /var/www/erp
```

Clone your Git repository:

```bash
git clone https://github.com/YOUR_USERNAME/ERP-Arab-Season.git .
```

*(Or upload your project files via SFTP / SCP from your local machine):*
```bash
# Run this from your local computer:
scp -r d:/freelanceprojects/ERP-Arab-Season-main/ERP-Arab-Season-main/* root@YOUR_HOSTINGER_VPS_IP:/var/www/erp/
```

---

## Step 5: Backend Setup & Migrations

```bash
cd /var/www/erp/backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Upgrade pip & install requirements
pip install --upgrade pip
pip install -r requirements.txt

# Create .env file
cp ../deploy/backend.env.example .env
nano .env
```

Set the variables in `.env`:
```env
DEBUG=False
SECRET_KEY=YOUR_GENERATED_SECRET_KEY
ALLOWED_HOSTS=erp.arabseason.info,YOUR_VPS_IP,127.0.0.1,localhost
DATABASE_URL=postgres://erp_user:ChooseAStrongPassword123!@localhost:5432/erp_db
CORS_ALLOWED_ORIGINS=https://erp.arabseason.info
CSRF_TRUSTED_ORIGINS=https://erp.arabseason.info
```

Run database migrations and collect static files:

```bash
python manage.py migrate
python manage.py collectstatic --noinput
```

### (Optional) Migrate Existing Local Data (`db.sqlite3` -> PostgreSQL)

If you want to migrate your existing database (`db.sqlite3`) to PostgreSQL:

1. **On your local machine** (inside `backend` folder):
   ```bash
   python manage.py dumpdata --natural-foreign --natural-primary -e contenttypes -e auth.Permission --indent 2 > datadump.json
   ```
2. Upload `datadump.json` to `/var/www/erp/backend/` on the VPS.
3. **On the VPS** (inside `backend` with `venv` activated):
   ```bash
   python manage.py loaddata datadump.json
   ```

*(Alternatively: if you want to use SQLite directly on the VPS initially, simply copy `db.sqlite3` to `/var/www/erp/backend/` and set `DATABASE_URL=sqlite:////var/www/erp/backend/db.sqlite3` in `.env`)*

---

## Step 6: Frontend Build

```bash
cd /var/www/erp/frontend

# Install node dependencies
npm install

# Build production bundle with relative API path
VITE_API_URL=/api/ npm run build
```

This compiles optimized assets directly into `/var/www/erp/frontend/dist`.

---

## Step 7: Configure Gunicorn Service (Systemd)

Create logs directory and set ownership:

```bash
mkdir -p /var/log/gunicorn
chown -R www-data:www-data /var/log/gunicorn
chown -R www-data:www-data /var/www/erp
```

Copy the systemd service file:

```bash
cp /var/www/erp/deploy/gunicorn.service /etc/systemd/system/gunicorn.service

# Reload systemd and start Gunicorn
systemctl daemon-reload
systemctl enable --now gunicorn
systemctl status gunicorn
```

---

## Step 8: Configure Nginx & SSL

1. Copy the Nginx configuration:
   ```bash
   cp /var/www/erp/deploy/nginx.conf /etc/nginx/sites-available/erp
   nano /etc/nginx/sites-available/erp
   ```
   *(Update `server_name` with your actual domain name, e.g. `erp.arabseason.info`)*

2. Enable the site and remove the default Nginx site:
   ```bash
   ln -s /etc/nginx/sites-available/erp /etc/nginx/sites-enabled/
   rm -f /etc/nginx/sites-enabled/default
   nginx -t
   systemctl reload nginx
   ```

3. Obtain free SSL certificate with Certbot:
   ```bash
   certbot --nginx -d erp.arabseason.info
   ```
   *Certbot will configure SSL certificates and set up automatic renewal.*

---

## Step 9: Automated Daily Database Backups

Ensure your data is automatically protected every day:

```bash
chmod +x /var/www/erp/deploy/backup_db.sh

# Open crontab
crontab -e
```

Add this line to back up the database automatically every night at 3:00 AM:
```cron
0 3 * * * /var/www/erp/deploy/backup_db.sh > /dev/null 2>&1
```

---

## Maintenance & Useful Commands

| Task | Command |
|---|---|
| Check backend status | `systemctl status gunicorn` |
| View backend live logs | `journalctl -u gunicorn -f` or `tail -f /var/log/gunicorn/error.log` |
| Restart backend | `systemctl restart gunicorn` |
| Reload Nginx | `nginx -t && systemctl reload nginx` |
| Update code after git pull | `cd /var/www/erp/backend && source venv/bin/activate && python manage.py migrate && cd ../frontend && npm run build && systemctl restart gunicorn` |

