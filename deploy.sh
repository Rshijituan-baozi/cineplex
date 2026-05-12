#!/bin/bash
set -e

# ============================================
#  SoybeanAdmin + Payment Backend 一键部署
#  Ubuntu 22.04 / 24.04
#
#  用法:
#    export DOMAIN=your-domain.com
#    export DB_PASSWORD=your_password
#    bash deploy.sh
# ============================================

REPO="${REPO:-https://github.com/Rshijituan-baozi/cineplex.git}"
APP_DIR="/app"
DOMAIN="${DOMAIN:-localhost}"
DB_PASSWORD="${DB_PASSWORD:-payment_secret_2024}"
JWT_SECRET="${JWT_SECRET:-$(openssl rand -hex 32)}"

echo "========================================"
echo "  SoybeanAdmin Deploy"
echo "  Domain: $DOMAIN"
echo "========================================"

# --- 1. 基础环境 ---
echo "[1/6] Installing system packages..."
sudo apt-get update -qq && sudo apt-get install -y -qq curl git nginx postgresql postgresql-contrib

# --- 2. Node.js 22 ---
echo "[2/6] Installing Node.js..."
command -v node &>/dev/null || (curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y -qq nodejs)

# --- 3. pnpm + pm2 ---
echo "[3/6] Installing pnpm + pm2..."
command -v pnpm &>/dev/null || npm install -g pnpm
command -v pm2 &>/dev/null || npm install -g pm2

# --- 4. 拉取代码 ---
echo "[4/6] Cloning repository..."
sudo mkdir -p $APP_DIR && sudo chown -R $USER:$USER $APP_DIR
if [ -d "$APP_DIR/soybean-admin" ]; then
  cd $APP_DIR/soybean-admin && git pull
else
  git clone $REPO $APP_DIR/soybean-admin
fi

# --- 5. PostgreSQL ---
echo "[5/6] Configuring PostgreSQL..."
sudo -u postgres psql -c "CREATE USER payment_admin WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE payment_db OWNER payment_admin;" 2>/dev/null || true

# --- 6. 环境变量 ---
cat > $APP_DIR/.env << EOF
DATABASE_URL=postgres://payment_admin:${DB_PASSWORD}@localhost:5432/payment_db
JWT_SECRET=${JWT_SECRET}
HTTP_PORT=9528
NODE_ENV=production
EOF

# --- 7. 构建前端 ---
echo "Building SoybeanAdmin frontend..."
cd $APP_DIR/soybean-admin
pnpm install --frozen-lockfile && pnpm build

# --- 8. 后端 ---
echo "Installing backend dependencies..."
cd $APP_DIR/soybean-admin/packages/server
pnpm install --frozen-lockfile

# --- 9. 启动服务 ---
pm2 delete all 2>/dev/null || true

pm2 start $APP_DIR/soybean-admin/packages/server/src/index.ts \
  --name backend \
  --node-args="--import tsx" \
  --cwd $APP_DIR/soybean-admin/packages/server

# --- 10. nginx ---
sudo tee /etc/nginx/sites-available/soybean > /dev/null << NGINX
server {
    listen 80;
    server_name $DOMAIN;

    root $APP_DIR/soybean-admin/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:9528;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
    }
}
NGINX

sudo ln -sf /etc/nginx/sites-available/soybean /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

pm2 save 2>/dev/null && pm2 startup systemd -u $USER --hp $HOME 2>/dev/null || true

echo "========================================"
echo "  部署完成!"
echo "  http://$DOMAIN"
echo "  账号: Super / 123456"
echo "========================================"
