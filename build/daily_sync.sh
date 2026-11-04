#!/usr/bin/env bash
# Daily sync: rebuild site data from the newest workbook, enforce coverage, test, then (optionally) push.
# Usage: build/daily_sync.sh [--push]   Run from the repo root (site/) or the workspace root.
set -euo pipefail
cd "$(dirname "$0")/.."
B=build
[ -f "$B/to_site_full.py" ] && python3 "$B/to_site_full.py"
python3 "$B/enrich_site.py"
python3 "$B/build_pipeline.py"       # Mack Living pipeline (reads v4-enrich.json, mack-living.json, build/bip_pipeline.json)
python3 "$B/build_site.py"           # site-data.json + Mack_Living_Pipeline.xlsx from one source
( cd "$( [ -d site ] && echo site || echo . )" && soffice --headless --calc --convert-to xlsx --outdir /tmp/mlrecalc Mack_Living_Pipeline.xlsx >/dev/null 2>&1 && cp /tmp/mlrecalc/Mack_Living_Pipeline.xlsx . ) || true
python3 "$B/coverage_check.py"          # fails unless every record has exactly one home and the workbook mirrors the tabs
S=$( [ -d site ] && echo site || echo . )
( cd "$S" && node mack-model.test.js >/dev/null && node partner-flow-model.test.js >/dev/null && node mack-pipeline-model.test.js >/dev/null )
if [ "${1:-}" = "--push" ]; then
  cd "$S" && git add v4-enrich.json sheets_public.json mack-pipeline.json site-data.json Mack_Living_Pipeline.xlsx; [ -f bip-data.json ] && git add bip-data.json; git add -f build/bip_pipeline.json build/bip_refresh.json 2>/dev/null; true && git diff --cached --quiet || { git -c user.name=pgraham974 -c user.email=75396411+pgraham974@users.noreply.github.com commit -qm "Daily sync: site data and workbook" && git push origin main; }
fi
echo "daily sync OK"
