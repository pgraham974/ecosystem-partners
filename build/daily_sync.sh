#!/usr/bin/env bash
# Daily sync: rebuild site data from the newest workbook, enforce coverage, test, then (optionally) push.
# Usage: build/daily_sync.sh [--push]   Run from the repo root (site/) or the workspace root.
set -euo pipefail
cd "$(dirname "$0")/.."
B=build
[ -f "$B/to_site_full.py" ] && python3 "$B/to_site_full.py"
python3 "$B/enrich_site.py"
python3 "$B/coverage_check.py"          # fails the sync if any workbook record is unmapped
S=$( [ -d site ] && echo site || echo . )
( cd "$S" && node mack-model.test.js >/dev/null && node partner-flow-model.test.js >/dev/null )
if [ "${1:-}" = "--push" ]; then
  cd "$S" && git add v4-enrich.json sheets_public.json && git diff --cached --quiet || { git -c user.name=pgraham974 -c user.email=75396411+pgraham974@users.noreply.github.com commit -qm "Daily sync: v4 data" && git push origin main; }
fi
echo "daily sync OK"
