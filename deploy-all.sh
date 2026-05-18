#!/bin/bash
# ============================================
#  一键部署: SoybeanAdmin + cineplex-mirror
#  用法: bash deploy-all.sh
# ============================================
set -e

APP_DIR="/app"
echo "========================================"
echo "  开始部署..."
echo "========================================"

# 1. 基础环境
echo "[1/8] 安装系统包..."
apt-get update -qq
apt-get install -y -qq curl git nginx postgresql postgresql-contrib

# 2. Node.js 22
command -v node &>/dev/null || (curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y -qq nodejs)

# 3. pnpm + pm2
echo "[2/8] 安装 pnpm pm2..."
npm install -g pnpm pm2

# 4. 拉取代码
echo "[3/8] 拉取代码..."
mkdir -p $APP_DIR
cd $APP_DIR
[ -d soybean-admin ] && (cd soybean-admin && git pull) || git clone https://github.com/Rshijituan-baozi/cineplex.git soybean-admin
[ -d cineplex-mirror ] && (cd cineplex-mirror && git pull) || git clone https://github.com/Rshijituan-baozi/cineplex-mirror.git

# 5. PostgreSQL
echo "[4/8] 配置 PostgreSQL..."
DB_PASS="Aa128128@"
su - postgres -c "psql -c \"CREATE USER payment_admin WITH PASSWORD '$DB_PASS';\"" 2>/dev/null || true
su - postgres -c "psql -c \"CREATE DATABASE payment_db OWNER payment_admin;\"" 2>/dev/null || true

# 6. 环境变量
echo "[5/8] 环境变量..."
cat > $APP_DIR/soybean-admin/packages/server/.env << EOF
DATABASE_URL=postgres://payment_admin:${DB_PASS}@localhost:5432/payment_db
JWT_SECRET=$(openssl rand -hex 32)
HTTP_PORT=9528
NODE_ENV=production
EOF

# 7. 构建前端
echo "[6/8] 构建 SoybeanAdmin..."
cd $APP_DIR/soybean-admin
pnpm install --frozen-lockfile 2>/dev/null || pnpm install
pnpm build

# 8. 后端依赖
echo "[7/8] 后端依赖..."
cd $APP_DIR/soybean-admin/packages/server
pnpm install --frozen-lockfile 2>/dev/null || pnpm install

# 9. cineplex-mirror 依赖
cd $APP_DIR/cineplex-mirror
npm install

# 10. 启动服务
echo "[8/8] 启动服务..."
pm2 delete all 2>/dev/null || true

pm2 start $APP_DIR/soybean-admin/packages/server/src/index.ts \
  --name backend \
  --node-args="--import tsx" \
  --cwd $APP_DIR/soybean-admin/packages/server

pm2 start $APP_DIR/cineplex-mirror/src/index.js \
  --name cineplex

# 11. nginx
cat > /etc/nginx/sites-available/soybean << 'NGINX'
# === 后台管理 (默认) ===
server {
    listen 80 default_server;
    server_name _;

    root /app/soybean-admin/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:9528/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}

# === 域名前端代理 ===
server {
    listen 80;
    server_name aig-research.solutions www.aig-research.solutions;

    location /api/ {
        proxy_pass http://127.0.0.1:9528/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}

# === 域名前端代理 ===
server {
    listen 80;
    server_name aig-research.solutions www.aig-research.solutions;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host www.cineplex.com;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/soybean /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true

echo ""
echo "========================================"
echo "  部署完成!"
echo "  后台管理: http://130.94.114.20"
echo "  账号: Super / 123456"
echo ""
echo "  cineplex 前端: http://aig-research.solutions (DNS 指向本机IP)"
echo "========================================"
