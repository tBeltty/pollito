#!/usr/bin/env bash
# Renders the 1200x630 Open Graph images (EN and ES) into public/assets/og/.
# Requires Google Chrome. Run from anywhere: ./scripts/og/build.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
OUT="$ROOT/public/assets/og"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$OUT"

render() { # lang h1 sub
  local lang="$1" h1="$2" sub="$3"
  sed -e "s|{{LANG}}|$lang|g" -e "s|{{ROOT}}|$ROOT|g" -e "s|{{H1}}|$h1|g" -e "s|{{SUB}}|$sub|g" \
    "$ROOT/scripts/og/template.html" > "$TMP/og-$lang.html"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files \
    --force-device-scale-factor=1 --window-size=1200,630 --virtual-time-budget=8000 \
    --screenshot="$OUT/og-$lang.png" "file://$TMP/og-$lang.html" >/dev/null 2>&1
  echo "wrote $OUT/og-$lang.png"
}

render en "Polls that close at quorum." "Team polls inside Slack."
render es "Votaciones que cierran al llegar al quórum." "Votaciones de equipo dentro de Slack."
