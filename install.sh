#!/bin/bash
set -e
REPO_ZIP_URL="${REPO_ZIP_URL:-}" # if set, installer will download zip; otherwise assume current directory contains files
WEBROOT="/var/www/hvm-nebula"
API_DIR="$WEBROOT/api"
PORT=3001

echo "🚀 HVM Nebula Panel Installer"

apt update -y
apt install -y nginx unzip curl nodejs npm

# If REPO_ZIP_URL provided, download and extract; else assume current dir has project files.
if [ -n "$REPO_ZIP_URL" ]; then
  tmp="/tmp/hvm_panel.zip"
  echo "📦 Downloading project from $REPO_ZIP_URL ..."
  curl -sL "$REPO_ZIP_URL" -o "$tmp"
  rm -rf "$WEBROOT"
  mkdir -p "$WEBROOT"
  unzip -o "$tmp" -d "$WEBROOT"
  rm -f "$tmp"
else
  echo "📁 Copying local project files to $WEBROOT ..."
  mkdir -p "$WEBROOT"
  cp -r ./* "$WEBROOT/"
fi

# Ensure API dir exists
mkdir -p "$API_DIR"

# Install Node deps
cd "$API_DIR"
if [ -f package.json ]; then
  echo "📦 Installing Node dependencies..."
  npm install --production
fi

# Get admin credentials
read -p "Enter admin username: " ADMIN_USER
read -s -p "Enter admin password: " ADMIN_PASS
echo ""

# Hash password using node one-liner
HASH=$(node -e "const bcrypt=require('bcrypt'); bcrypt.hash(process.env.P,10).then(h=>console.log(h)).catch(e=>{console.error(e);process.exit(1)});" P="$ADMIN_PASS")

cat > "$API_DIR/users.json" <<EOF
{
  "$ADMIN_USER": {
    "password": "$HASH",
    "role": "admin"
  }
}
EOF

# create servers.json if missing
if [ ! -f "$API_DIR/servers.json" ]; then
  echo "{}" > "$API_DIR/servers.json"
fi

# create systemd unit
cat > /etc/systemd/system/hvm-panel.service <<'EOF'
[Unit]
Description=HVM Panel Node Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/hvm-nebula/api
ExecStart=/usr/bin/node server.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable hvm-panel
systemctl restart hvm-panel || true

# nginx config
NGINX_CONF="/etc/nginx/sites-available/hvm-nebula"
cat > "$NGINX_CONF" <<EOF
server {
  listen 80;
  server_name _;
  location / {
    proxy_pass http://127.0.0.1:${PORT}/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host \$host;
    proxy_cache_bypass \$http_upgrade;
  }
}
EOF

ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/hvm-nebula
nginx -t && systemctl restart nginx || true

IP=$(hostname -I | awk '{print $1}')
echo ""
echo "✅ Installation complete!"
echo "Visit: http://$IP"
echo "Admin username: $ADMIN_USER"
