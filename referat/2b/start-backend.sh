#!/bin/bash
# VERSUCHSCODE (Referat 2B, Schritt 4.3) – kein Produktpfad.
# Startet das lokale Backend für den Burst-Versuch. Variiert werden nur QA_NLP_ENABLED und
# QA_NLP_QUEUE_LIMIT; Timeout/Concurrency/Schwelle explizit auf Produkt-Defaults (2000 ms, 1, 0.55),
# damit keine Werte aus .env einfließen. Alle übrigen KI-Pfade sind aus (keine Runtime, kein Encoder, kein spaCy).
# Aufruf aus Repo-Root: referat/2b/start-backend.sh <true|false> <queueLimit> <logdatei>
set -euo pipefail
ENABLED=$1; LIMIT=$2; LOG=$3
cd apps/backend
export QA_NLP_ENABLED="$ENABLED" QA_NLP_QUEUE_LIMIT="$LIMIT" \
  QA_NLP_TIMEOUT_MS=2000 QA_NLP_CONCURRENCY=1 QA_NLP_MIN_CONFIDENCE=0.55 \
  OPEN_WEIGHT_LLM_ENABLED=false QA_SUMMARY_ENABLED=false NLP_ENABLED=false WORD_CLOUD_SEMANTIC_ENABLED=false
exec npx tsx src/index.ts > "../../$LOG" 2>&1
