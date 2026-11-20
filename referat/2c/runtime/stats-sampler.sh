#!/bin/sh
# Versuchscode (Referat 2C, Schritt 5.1): docker stats im Dauerstrom als CSV.
# Aufruf: stats-sampler.sh <container> <out.csv>   (Stop per kill)
C=$1; OUT=$2
echo "ts_ms,mem_usage,mem_perc,cpu_perc,pids" > "$OUT"
docker stats --format '{{.MemUsage}},{{.MemPerc}},{{.CPUPerc}},{{.PIDs}}' "$C" | while IFS= read -r l; do
  l=$(printf '%s' "$l" | sed 's/\x1b\[[0-9;]*[A-Za-z]//g'); [ -n "$l" ] && echo "$(date +%s%3N),$l" >> "$OUT"
done
