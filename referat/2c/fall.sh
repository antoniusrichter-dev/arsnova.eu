#!/bin/bash
# VERSUCHSCODE (Referat 2C, 5.2/5.3): ein Fall = frischer Seed + Sampler + Lauf-Skript.
# Aufruf aus Repo-Root: referat/2c/fall.sh <baseline|ablation> <a|b|c|d> [laeufe] [Harness-Zusatzargumente]
# OUTDIR überschreibt das Ausgabeverzeichnis (Wiederholung nach OOM getrennt ablegen).
set -euo pipefail
MODUS=$1; FALL=$2; N=${3:-5}; shift 3 2>/dev/null || shift $#; EXTRA=("$@")
C=arsnova-v3-open-weight-llm-http
case "$FALL" in
  a) NAME=a-P200;                SEED=(npx tsx referat/fixtures/seed-sechs-fragen.ts --p 200) ;;
  b) NAME=b-P200-lernziel;       SEED=(npx tsx referat/fixtures/seed-sechs-fragen.ts --p 200 --lernziel) ;;
  c) NAME=c-P50skaliert-lernziel; SEED=(npx tsx referat/fixtures/seed-sechs-fragen.ts --p 50 --skaliert --lernziel) ;;
  d) NAME=d-456-teilmenge;       SEED=(npx tsx referat/2c/seed-issue456-teilmenge.ts --teilnehmende 30) ;;
  *) echo "Fall a|b|c|d"; exit 64 ;;
esac
OUT=${OUTDIR:-referat/evidenz/2c/$MODUS}; mkdir -p "$OUT" referat/evidenz/2c/seed
SEEDOUT=referat/evidenz/2c/seed/$MODUS${OUTDIR:+-$(basename "$OUTDIR")}-$NAME.json
"${SEED[@]}" --out "$SEEDOUT" | tail -2
referat/2c/runtime/mem-sampler.sh $C "$OUT/$NAME-mem.csv" 1 & MS=$!
referat/2c/runtime/stats-sampler.sh $C "$OUT/$NAME-docker-stats.csv" & SS=$!
trap 'kill $MS 2>/dev/null; pkill -P $SS 2>/dev/null; kill $SS 2>/dev/null; true' EXIT
if [ "$MODUS" = baseline ]; then
  node referat/2c/baseline-lauf.mjs --seed "$SEEDOUT" --fall "$NAME" --laeufe "$N" --out "$OUT"
else
  referat/2c/start-harness.sh --seed "$SEEDOUT" --fall "$NAME" --laeufe "$N" --out "$OUT" "${EXTRA[@]}"
fi
sleep 3
