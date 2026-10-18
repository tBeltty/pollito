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

if grep -q "^SLACK_BOT_TOKEN=" "${ENV_FILE}"; then
  sed -i "s|^SLACK_BOT_TOKEN=.*|SLACK_BOT_TOKEN=${TOKEN}|" "${ENV_FILE}"
else
  echo "SLACK_BOT_TOKEN=${TOKEN}" >> "${ENV_FILE}"
fi

chmod 600 "${ENV_FILE}"
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
