#!/usr/bin/env bash
# Lernkiste – alle Prüfungen in einem Lauf (lokal und in GitHub Actions).
# Aufruf: bash tools/lk_test.sh [index.html]
# jsdom: entweder JSDOM_PATH=/pfad/node_modules/jsdom setzen oder `npm i --no-save jsdom@24` im Repo.
set -euo pipefail
cd "$(dirname "$0")/.."
F="${1:-index.html}"
fail=0
run() { echo "▶ $1"; shift; if "$@"; then echo "  ✔ ok"; else echo "  ✘ FEHLER"; fail=1; fi; }

run "Rauchtest"        node tools/lk_smoke.js "$F"
run "Abnahmetests"     node tests/abnahme.js "$F"
run "Prüfregeln"       node tests/pruefregeln.js "$F"

run "Stapel prüfen" python3 - "$F" <<'PY'
import sys; sys.path.insert(0, "tools"); import lk_deck as L
bad = 0
for i, d in L.read_blocks(open(sys.argv[1], encoding="utf-8").read()):
    e, w = L.validate(d)
    for x in e: print("   FEHLER", i, x)
    for x in w: print("   WARNUNG", i, x)
    bad += len(e)
sys.exit(1 if bad else 0)
PY

check_versions() {
  local V C
  V=$(grep -o 'APP_VERSION="[^"]*"' "$F" | cut -d'"' -f2)
  C=$(grep -o 'lernkiste-v[0-9-]*' sw.js | head -1)
  echo "   APP_VERSION=$V · sw.js=$C"
  [ "$C" = "lernkiste-v${V//./-}" ]        || { echo "   sw.js CACHE passt nicht zu $V"; return 1; }
  grep -q "^## $V " CHANGELOG.md           || { echo "   CHANGELOG ohne Eintrag $V"; return 1; }
  [ -f "versions/lernkiste-v$V.html" ]     || { echo "   versions/lernkiste-v$V.html fehlt"; return 1; }
  cmp -s "$F" "versions/lernkiste-v$V.html" || { echo "   Archivkopie weicht von $F ab"; return 1; }
}
run "Versionen konsistent" check_versions

[ $fail -eq 0 ] && echo "ALLE PRÜFUNGEN GRÜN" || { echo "PRÜFUNG FEHLGESCHLAGEN"; exit 1; }
