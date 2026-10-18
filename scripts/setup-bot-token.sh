#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="/home/jhonatan/pollito/.env"

echo "Configurador Seguro de SLACK_BOT_TOKEN"
echo "Obtén el nuevo token en: https://api.slack.com/apps/A0C9YDMH6CV (OAuth & Permissions -> Bot User OAuth Token)"
echo ""
read -s -r -p "Pega tu nuevo Bot User OAuth Token (xoxb-...) > " TOKEN
echo ""

if [[ ! "${TOKEN}" =~ ^xoxb- ]]; then
  echo "Error: El token debe comenzar con xoxb-"
  exit 1
fi

printf '%s' "${TOKEN}" | ENV_FILE="${ENV_FILE}" node -e '
const fs = require("fs");
let token = "";
process.stdin.on("data", chunk => { token += chunk; });
process.stdin.on("end", () => {
  token = token.trim();
  const envFile = process.env.ENV_FILE || "/home/jhonatan/pollito/.env";
  let content = fs.existsSync(envFile) ? fs.readFileSync(envFile, "utf8") : "";
  if (/^SLACK_BOT_TOKEN=/m.test(content)) {
    content = content.replace(/^SLACK_BOT_TOKEN=.*/m, `SLACK_BOT_TOKEN="${token}"`);
  } else {
    content += (content.endsWith("\n") || !content ? "" : "\n") + `SLACK_BOT_TOKEN="${token}"\n`;
  }
  fs.writeFileSync(envFile, content, { mode: 0o600 });
});
'
chmod 600 "${ENV_FILE}"
unset TOKEN
pm2 restart pollito

echo "Verificando nuevo token con Slack API..."
cd /home/jhonatan/pollito
node -e '
import("@slack/web-api").then(async ({ WebClient }) => {
  const dotenv = await import("dotenv");
  dotenv.config();
  const client = new WebClient(process.env.SLACK_BOT_TOKEN);
  try {
    const auth = await client.auth.test();
    console.log("SUCCESS: Conectado a Slack como @" + auth.user + " en " + auth.team + "!");
  } catch (err) {
    console.log("ERROR:", err.data || err.message);
  }
});
'
