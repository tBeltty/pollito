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

if grep -q "^SLACK_SIGNING_SECRET=" "${ENV_FILE}"; then
  # Replace existing line
  sed -i "s/^SLACK_SIGNING_SECRET=.*/SLACK_SIGNING_SECRET=${SECRET}/" "${ENV_FILE}"
else
  # Append
  echo "SLACK_SIGNING_SECRET=${SECRET}" >> "${ENV_FILE}"
fi

chmod 600 "${ENV_FILE}"
pm2 restart pollito
echo "SLACK_SIGNING_SECRET actualizado con éxito y Pollito reiniciado."
