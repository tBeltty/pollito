#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Blind-Secret Ingestion Script for Pollito Slack App (OAuth Credentials)
# Complies with ~/.gemini/config/rules/blind-secrets.md
# ==============================================================================

VPS_HOST="${VPS_HOST:-mi-vps}"

echo "🔒 Pollito OAuth Secrets Setup"
echo "--------------------------------------------------------"
echo "This script securely updates Slack OAuth credentials on ${VPS_HOST} without exposing"
echo "them in shell history, command-line arguments, chat logs, or LLM transcripts."
echo ""

# 1. Capture Slack Client ID (defaults to Pollito's public Client ID if Enter is pressed)
DEFAULT_CLIENT_ID="12145588418240.12338463584437"
read -r -p "1. Enter Slack Client ID [Press Enter for ${DEFAULT_CLIENT_ID}]: " INPUT_CLIENT_ID
SLACK_CLIENT_ID="${INPUT_CLIENT_ID:-$DEFAULT_CLIENT_ID}"

# 2. Capture Slack Client Secret silently
read -s -r -p "2. Enter Slack Client Secret: " SLACK_CLIENT_SECRET
echo ""
if [[ -z "$SLACK_CLIENT_SECRET" ]]; then
  echo "❌ Error: Client secret cannot be empty."
  exit 1
fi

# 3. Generate SLACK_STATE_SECRET if not provided
SLACK_STATE_SECRET="${SLACK_STATE_SECRET:-$(openssl rand -hex 32)}"

echo ""
echo "🚀 Configuring remote server (${VPS_HOST})..."

# 4. Stream configuration directly to remote VPS via SSH without exposing secrets in argv
printf '%s\n%s\n%s\n' "$SLACK_CLIENT_ID" "$SLACK_CLIENT_SECRET" "$SLACK_STATE_SECRET" | ssh "$VPS_HOST" 'node -e '\''
const fs = require("fs");
const readline = require("readline");

const rl = readline.createInterface({ input: process.stdin });
const lines = [];
rl.on("line", line => lines.push(line));
rl.on("close", () => {
  const [clientId, clientSecret, stateSecret] = lines;
  const envPath = "/home/jhonatan/pollito/.env";
  let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";

  function setVar(key, val) {
    const re = new RegExp(`^${key}=.*$`, "m");
    if (re.test(content)) {
      content = content.replace(re, `${key}="${val}"`);
    } else {
      content += (content.endsWith("\n") || !content ? "" : "\n") + `${key}="${val}"\n`;
    }
  }

  if (clientId) setVar("SLACK_CLIENT_ID", clientId);
  if (clientSecret) setVar("SLACK_CLIENT_SECRET", clientSecret);

  // Set SLACK_STATE_SECRET only if not already present
  if (!/^SLACK_STATE_SECRET=/m.test(content) && stateSecret) {
    setVar("SLACK_STATE_SECRET", stateSecret);
  }

  fs.writeFileSync(envPath, content, { mode: 0o600 });
  console.log("Updated OAuth secrets in " + envPath);
});
'\'' && chmod 600 /home/jhonatan/pollito/.env && pm2 restart pollito --update-env && sleep 2 && curl -fsS http://127.0.0.1:3015/healthz'

# Clear variables from local subshell memory
unset SLACK_CLIENT_ID
unset SLACK_CLIENT_SECRET
unset SLACK_STATE_SECRET

echo ""
echo "✅ OAuth credentials configured successfully on production server!"
echo "📡 Public verification: https://pollito.tbelt.online/healthz"
