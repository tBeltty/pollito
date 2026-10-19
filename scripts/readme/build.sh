#!/usr/bin/env bash
# Renders assets/readme-hero.png (the README banner) from the landing hero artwork.
# Requires Google Chrome. Run from anywhere: ./scripts/readme/build.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

sed -e "s|{{ROOT}}|$ROOT|g" "$ROOT/scripts/readme/template.html" > "$TMP/hero.html"
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files \
  --force-device-scale-factor=2 --window-size=1200,675 --virtual-time-budget=8000 \
  --screenshot="$ROOT/assets/readme-hero.png" "file://$TMP/hero.html" >/dev/null 2>&1
echo "wrote $ROOT/assets/readme-hero.png"
