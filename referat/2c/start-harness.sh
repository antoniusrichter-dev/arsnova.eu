#!/bin/bash
# VERSUCHSCODE (Referat 2C, 5.3): startet den Ablations-Harness mit denselben LLM-Flags
# wie das Backend (Proxy 127.0.0.1:8081). Token nie ausgegeben.
set -euo pipefail
TOKEN=$(/usr/bin/grep -oP 'OPEN_WEIGHT_LLM_TOKEN:-\K[^}]+' docker-compose.yml | head -1)
export OPEN_WEIGHT_LLM_ENABLED=true OPEN_WEIGHT_LLM_URL=http://127.0.0.1:8081 OPEN_WEIGHT_LLM_SOCKET_PATH= \
  OPEN_WEIGHT_LLM_TOKEN="$TOKEN" OPEN_WEIGHT_LLM_LABEL_TIMEOUT_MS=30000 OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_MS=90000 \
  OPEN_WEIGHT_LLM_LEARNING_TIMEOUT_MS=300000 QA_SUMMARY_ENABLED=true QA_SUMMARY_INFERENCE_URL= \
  QA_SUMMARY_INFERENCE_TOKEN= QA_SUMMARY_TIMEOUT_MS=90000 QA_NLP_ENABLED=false NLP_ENABLED=false \
  WORD_CLOUD_SEMANTIC_ENABLED=false
npx tsx referat/2c/ablation-harness.ts "$@" 2>&1 | sed -u -e "s/$TOKEN/***/g" -E -e 's/(Bearer )[^ "]+/\1***/g'
exit "${PIPESTATUS[0]}"
