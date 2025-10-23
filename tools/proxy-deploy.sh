#!/usr/bin/env bash
# Simple VPS bootstrap to run tools/ipv6-proxy.js as a systemd service
# Usage on a fresh Ubuntu 22.04/24.04 droplet:
# curl -fsSL https://your-host/path/tools/proxy-deploy.sh | sudo TARGET_IPV6=2406:da1a:6b0:f60c:a3b9:19f9:b2bc:d22b bash

set -euo pipefail
TARGET_IPV6=${TARGET_IPV6:-}
TARGET_PORT=${TARGET_PORT:-5432}
LISTEN_PORT=${LISTEN_PORT:-5432}
APP_DIR=/srv/ipv6-proxy
NODE_BIN=/usr/bin/node

if [ -z "$TARGET_IPV6" ]; then
  echo "Usage: TARGET_IPV6=<ipv6-address> bash proxy-deploy.sh"
  exit 2
fi

# Install Node (minimal)
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get update
  apt-get install -y nodejs build-essential
fi

# Create app dir
mkdir -p $APP_DIR/tools
cat > $APP_DIR/tools/ipv6-proxy.js <<'EOF'
$(sed -n '1,200p' tools/ipv6-proxy.js)
EOF

# Create systemd unit
cat > /etc/systemd/system/ipv6-proxy.service <<EOF
[Unit]
Description=IPv6-to-IPv4 Postgres proxy
After=network.target

[Service]
Type=simple
User=nobody
ExecStart=$NODE_BIN $APP_DIR/tools/ipv6-proxy.js $LISTEN_PORT $TARGET_IPV6 $TARGET_PORT
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

# Start service
systemctl daemon-reload
systemctl enable --now ipv6-proxy.service

# Configure ufw (optional)
if command -v ufw >/dev/null 2>&1; then
  ufw allow $LISTEN_PORT/tcp
  ufw --force enable
fi

echo "Proxy deployed and running: 0.0.0.0:$LISTEN_PORT -> [$TARGET_IPV6]:$TARGET_PORT"

# Print public IP for convenience
curl -4 ifconfig.co || true
