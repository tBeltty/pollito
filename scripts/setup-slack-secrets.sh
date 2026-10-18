#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Blind-Secret Ingestion Script for Pollito Slack App
# Complies with ~/.gemini/config/rules/blind-secrets.md
# ==============================================================================

echo "🔒 Pollito Blind-Secret Setup"
echo "--------------------------------------------------------"
echo "This script securely updates Slack credentials without exposing them"
echo "in shell history, chat logs, or LLM transcripts."
echo ""

# 1. Capture Bot User OAuth Token silently
read -s -r -p "1. Enter Slack Bot User OAuth Token (xoxb-...): " SLACK_BOT_TOKEN
echo ""
if [[ -z "$SLACK_BOT_TOKEN" || ! "$SLACK_BOT_TOKEN" =~ ^xoxb- ]]; then
  echo "❌ Error: Token must start with 'xoxb-' and cannot be empty."
  exit 1
fi

# 2. Capture Slack Signing Secret silently
read -s -r -p "2. Enter Slack Signing Secret: " SLACK_SIGNING_SECRET
echo ""
if [[ -z "$SLACK_SIGNING_SECRET" ]]; then
  echo "❌ Error: Signing secret cannot be empty."
  exit 1
fi

echo ""
echo "🚀 Configuring remote server (mi-vps)..."

# 3. Stream configuration directly to remote VPS via SSH without saving locally
ssh mi-vps bash -s <<EOF
set -euo pipefail
PROD_ENV="/home/jhonatan/pollito/.env"

if [[ ! -f "\$PROD_ENV" ]]; then
  echo "Creating new \$PROD_ENV file..."
  touch "\$PROD_ENV"
fi

chmod 600 "\$PROD_ENV"

# Update or insert SLACK_BOT_TOKEN
if grep -q "^SLACK_BOT_TOKEN=" "\$PROD_ENV"; then
  sed -i "s|^SLACK_BOT_TOKEN=.*|SLACK_BOT_TOKEN=\"$SLACK_BOT_TOKEN\"|" "\$PROD_ENV"
else
  echo "SLACK_BOT_TOKEN=\"$SLACK_BOT_TOKEN\"" >> "\$PROD_ENV"
fi

# Update or insert SLACK_SIGNING_SECRET
if grep -q "^SLACK_SIGNING_SECRET=" "\$PROD_ENV"; then
  sed -i "s|^SLACK_SIGNING_SECRET=.*|SLACK_SIGNING_SECRET=\"$SLACK_SIGNING_SECRET\"|" "\$PROD_ENV"
else
  echo "SLACK_SIGNING_SECRET=\"$SLACK_SIGNING_SECRET\"" >> "\$PROD_ENV"
fi

echo "Restarting Pollito on PM2 with updated secrets..."
pm2 restart pollito --update-env

echo "Verifying local service..."
sleep 2
curl -fsS http://127.0.0.1:3015/healthz
EOF

# Clear variables from local subshell memory
unset SLACK_BOT_TOKEN
unset SLACK_SIGNING_SECRET

echo ""
echo "✅ Credentials configured successfully on production server!"
echo "📡 Public verification: https://pollito.tbelt.online/healthz"
