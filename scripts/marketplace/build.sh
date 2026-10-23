#!/usr/bin/env bash
# Renders the 6 Slack Marketplace gallery images (1600x1000, 8:5 ratio, <2MB PNG)
# into assets/marketplace/.
# Requires Google Chrome. Run from anywhere: ./scripts/marketplace/build.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
OUT="$ROOT/assets/marketplace"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$OUT"

node "$ROOT/scripts/marketplace/generate-html.mjs" "$TMP"

for html_file in "$TMP"/*.html; do
  base="$(basename "$html_file" .html)"
  out_png="$OUT/$base.png"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files \
    --force-device-scale-factor=1 --window-size=1600,1000 --virtual-time-budget=8000 \
    --screenshot="$out_png" "file://$html_file" >/dev/null 2>&1
  echo "wrote $out_png"
done
