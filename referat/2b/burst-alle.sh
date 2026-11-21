#!/bin/bash
# VERSUCHSCODE (Referat 2B, Schritt 4.3) – kein Produktpfad.
# Je Konfiguration: Backend frisch starten (Zähler bei 0), 3 Bursts à 200 qa.submit, Backend stoppen.
# Konfigurationen: aus (QA_NLP_ENABLED=false), an-limit100, an-limit20.
# Aufruf aus Repo-Root: referat/2b/burst-alle.sh [laeufe]
set -uo pipefail
N=${1:-3}
OUT=referat/evidenz/2b/last; mkdir -p "$OUT"
for K in "aus false 100" "an-limit100 true 100" "an-limit20 true 20"; do
  set -- $K; NAME=$1; EN=$2; LIM=$3
  echo "== $NAME (QA_NLP_ENABLED=$EN, QA_NLP_QUEUE_LIMIT=$LIM) Start $(date -Is)"
  referat/2b/start-backend.sh "$EN" "$LIM" "$OUT/backend-$NAME.log" & BP=$!
  for i in $(seq 1 90); do curl -sf -o /dev/null http://127.0.0.1:3000/trpc/health.check && break; sleep 1; done
  PID=$(ss -ltnp 2>/dev/null | /usr/bin/grep -E '[:.]3000\b' | /usr/bin/grep -oP 'pid=\K[0-9]+' | head -1)
  [ -z "$PID" ] && { echo "Backend nicht erreichbar"; kill $BP 2>/dev/null; exit 1; }
  echo "Backend-PID $PID ($(tr '\0' ' ' < /proc/$PID/cmdline | cut -c1-60)…)"
  for L in $(seq 1 "$N"); do
    npx tsx referat/2b/burst.ts --pid "$PID" --konfig "$NAME" --lauf "$L" --out "$OUT/$NAME-lauf$L.json" || { echo "Lauf fehlgeschlagen"; kill $PID; exit 1; }
    sleep 3
  done
  kill "$PID"; wait $BP 2>/dev/null
  for i in $(seq 1 20); do ss -ltn | /usr/bin/grep -qE '[:.]3000\b' || break; sleep 1; done
  echo "== $NAME Ende $(date -Is)"
done
