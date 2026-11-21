#!/bin/bash
# VERSUCHSCODE (Referat 2C, 5.2/5.3): startet Backend mit festen 2C-Flags gegen den
# aufzeichnenden Proxy 127.0.0.1:8081 (-> Runtime 127.0.0.1:8080).
# Token = Compose-Default aus docker-compose.yml, wird nie ausgegeben; Log geschwärzt.
# Aufruf aus Repo-Root: referat/2c/start-backend.sh <logdatei>
set -euo pipefail
LOG=$1
TOKEN=$(/usr/bin/grep -oP 'OPEN_WEIGHT_LLM_TOKEN:-\K[^}]+' docker-compose.yml | head -1)
cd apps/backend
export OPEN_WEIGHT_LLM_ENABLED=true OPEN_WEIGHT_LLM_URL=http://127.0.0.1:8081 OPEN_WEIGHT_LLM_SOCKET_PATH= \
  OPEN_WEIGHT_LLM_TOKEN="$TOKEN" OPEN_WEIGHT_LLM_LABEL_TIMEOUT_MS=30000 OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_MS=90000 \
  OPEN_WEIGHT_LLM_LEARNING_TIMEOUT_MS=300000 QA_SUMMARY_ENABLED=true QA_SUMMARY_INFERENCE_URL= \
  QA_SUMMARY_INFERENCE_TOKEN= QA_SUMMARY_TIMEOUT_MS=90000 QA_SUMMARY_QUEUE_LIMIT=8 QA_SUMMARY_CONCURRENCY=1 \
  QA_SUMMARY_COOLDOWN_MS=5000 QA_SUMMARY_TTL_MS=1800000 QA_NLP_ENABLED=false NLP_ENABLED=false \
  WORD_CLOUD_SEMANTIC_ENABLED=false
exec npx tsx src/index.ts 2>&1 | sed -u -e "s/$TOKEN/***/g" -E -e 's/(Bearer )[^ "]+/\1***/g' > "../../$LOG"
