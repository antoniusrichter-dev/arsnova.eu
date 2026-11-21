#!/bin/bash
# VERSUCHSCODE (Referat 2C, 5.3): Ablationsfälle nacheinander.
cd "$(dirname "$0")/../.."
for f in "$@"; do T0=$(date +%s); echo "== Fall $f Start $(date -Is)"; referat/2c/fall.sh ablation "$f" 5; echo "== Fall $f Ende $(date -Is) Dauer $(( $(date +%s)-T0 )) s exit $?"; done
