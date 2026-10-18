#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="/home/jhonatan/pollito/.env"

echo "Configurador Seguro de SLACK_SIGNING_SECRET"
echo "Obtén el Signing Secret en: https://api.slack.com/apps/A0C9YDMH6CV (Basic Information -> App Credentials -> Signing Secret)"
echo ""
read -s -r -p "Pega tu Slack Signing Secret > " SECRET
echo ""

if [ -z "${SECRET}" ]; then
  echo "Error: El secret no puede estar vacío."
  exit 1
fi

printf '%s' "${SECRET}" | ENV_FILE="${ENV_FILE}" node -e '
const fs = require("fs");
let secret = "";
process.stdin.on("data", chunk => { secret += chunk; });
process.stdin.on("end", () => {
  secret = secret.trim();
  const envFile = process.env.ENV_FILE || "/home/jhonatan/pollito/.env";
  let content = fs.existsSync(envFile) ? fs.readFileSync(envFile, "utf8") : "";
  if (/^SLACK_SIGNING_SECRET=/m.test(content)) {
    content = content.replace(/^SLACK_SIGNING_SECRET=.*/m, `SLACK_SIGNING_SECRET="${secret}"`);
  } else {
    content += (content.endsWith("\n") || !content ? "" : "\n") + `SLACK_SIGNING_SECRET="${secret}"\n`;
  }
  fs.writeFileSync(envFile, content, { mode: 0o600 });
});
'
chmod 600 "${ENV_FILE}"
unset SECRET
pm2 restart pollito
echo "SLACK_SIGNING_SECRET actualizado con éxito y Pollito reiniciado."
