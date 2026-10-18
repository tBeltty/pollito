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

VPS_HOST="${VPS_HOST:-mi-vps}"
# 3. Stream configuration directly to remote VPS via SSH without exposing secrets in argv
printf '%s\n%s\n' "$SLACK_BOT_TOKEN" "$SLACK_SIGNING_SECRET" | ssh "$VPS_HOST" 'node -e '\''
const fs = require("fs");
const readline = require("readline");

const rl = readline.createInterface({ input: process.stdin });
const lines = [];
rl.on("line", line => lines.push(line));
rl.on("close", () => {
  const [botToken, signingSecret] = lines;
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

  if (botToken) setVar("SLACK_BOT_TOKEN", botToken);
  if (signingSecret) setVar("SLACK_SIGNING_SECRET", signingSecret);

  fs.writeFileSync(envPath, content, { mode: 0o600 });
  console.log("Updated secrets in " + envPath);
});
'\'' && chmod 600 /home/jhonatan/pollito/.env && pm2 restart pollito --update-env && sleep 2 && curl -fsS http://127.0.0.1:3015/healthz'

# Clear variables from local subshell memory
unset SLACK_BOT_TOKEN
unset SLACK_SIGNING_SECRET

echo ""
echo "✅ Credentials configured successfully on production server!"
echo "📡 Public verification: https://pollito.tbelt.online/healthz"
