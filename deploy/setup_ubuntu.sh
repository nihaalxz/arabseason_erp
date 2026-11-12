#!/bin/bash
# ==============================================================================
# Hostinger VPS KVM 4 - Initial Server Setup Script (Ubuntu 22.04 / 24.04 LTS)
# ==============================================================================
set -e

echo "=== 1. Updating System Packages ==="
apt update && apt upgrade -y

echo "=== 2. Installing Core Dependencies ==="
apt install -y python3 python3-pip python3-venv python3-dev \
    build-essential libpq-dev nginx git curl ufw fail2ban \
    postgresql postgresql-contrib

echo "=== 3. Installing Node.js 20 LTS ==="
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

echo "=== 4. Configuring UFW Firewall ==="
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo "=== 5. Creating Project Directories ==="
mkdir -p /var/www/erp
mkdir -p /var/log/gunicorn
mkdir -p /var/backups/erp
chown -R www-data:www-data /var/log/gunicorn

echo "=== Setup Complete! ==="
echo "Next steps:"
echo "1. Clone/copy project into /var/www/erp"
echo "2. Setup PostgreSQL database and user"
echo "3. Create backend venv & install requirements"
echo "4. Build frontend with 'npm run build'"
echo "5. Link deploy/gunicorn.service and deploy/nginx.conf"

