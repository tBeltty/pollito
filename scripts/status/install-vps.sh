#!/usr/bin/env bash
# One-time setup of the public status page on the VPS. Run it from your machine:
#   ssh mi-vps 'bash -s' < scripts/status/install-vps.sh
# It is safe to run twice. It backs up the nginx file, validates the new config before
# reloading (and restores the backup if validation fails), and adds the probe to cron once.
set -euo pipefail

APP_DIR=/home/jhonatan/pollito
CONF=/etc/nginx/sites-enabled/pollito.tbelt.online.conf
BACKUP="/root/pollito.tbelt.online.conf.bak-$(date +%Y%m%d%H%M%S)"
CRON_LINE="* * * * * cd $APP_DIR && /usr/bin/node dist/status/probe.js >> $APP_DIR/data/status/probe.log 2>&1"

test -f "$APP_DIR/dist/status/probe.js" || { echo "dist/status/probe.js is missing: wait for the deploy to finish"; exit 1; }

# 1. nginx: map /status/status.json to the probe output
if grep -q "/status/status.json" "$CONF"; then
  echo "nginx: location already present"
else
  cp -p "$CONF" "$BACKUP"
  python3 - "$CONF" <<'PY'
import sys
path = sys.argv[1]
text = open(path).read()
block = """    location = /status/status.json {
        alias /home/jhonatan/pollito/data/status/status.json;
        default_type application/json;
        add_header Cache-Control "no-store" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Frame-Options "DENY" always;
    }

"""
marker = "    location / {\n"
assert text.count(marker) == 1, "expected exactly one 'location /' block"
open(path, "w").write(text.replace(marker, block + marker))
PY
  if nginx -t; then
    systemctl reload nginx
    echo "nginx: reloaded (backup at $BACKUP)"
  else
    cp -p "$BACKUP" "$CONF"
    echo "nginx: config test failed, original restored"
    exit 1
  fi
fi

# 2. First probe run, so status.json exists before the cron job starts
mkdir -p "$APP_DIR/data/status"
(cd "$APP_DIR" && node dist/status/probe.js)

# 3. cron: run the probe every minute (root runs PM2 on this server)
if crontab -l 2>/dev/null | grep -qF "dist/status/probe.js"; then
  echo "cron: probe already scheduled"
else
  (crontab -l 2>/dev/null; echo "$CRON_LINE") | crontab -
  echo "cron: probe scheduled"
fi

echo "---"
curl -sS --resolve pollito.tbelt.online:443:127.0.0.1 https://pollito.tbelt.online/status/status.json -o /dev/null -w "status.json through nginx: HTTP %{http_code}\n" || true
cat "$APP_DIR/data/status/status.json" | head -c 300; echo
