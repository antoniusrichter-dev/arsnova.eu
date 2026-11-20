#!/bin/sh
# Versuchscode (Referat 2C, Schritt 5.1), kein Produktpfad.
# Speicher-Sampler für den LLM-Runtime-Container, getrennt nach
#   Prozess (llama-server: RssAnon = echter Prozessspeicher, RssFile = per mmap
#   eingeblendete GGUF-Seiten im Page Cache, VmSwap = ausgelagert) und
#   cgroup v2 (anon, file, file_mapped, swap.current, current, peak, events).
# Aufruf: mem-sampler.sh <container> <out.csv> <intervall_s>   (Stop per kill)
set -eu
C=$1; OUT=$2; IV=${3:-1}
echo "ts_ms,cg_current,cg_peak,cg_anon,cg_file,cg_file_mapped,cg_shmem,cg_swap_current,cg_oom,cg_oom_kill,cg_high,cg_max,proc_vmrss_kb,proc_rssanon_kb,proc_rssfile_kb,proc_rssshmem_kb,proc_vmswap_kb" > "$OUT"
while :; do
  line=$(docker exec "$C" sh -c '
    cg=/sys/fs/cgroup
    st() { awk -v k="$1" "\$1==k{print \$2}" $cg/memory.stat; }
    ev() { awk -v k="$1" "\$1==k{print \$2}" $cg/memory.events; }
    pid=""; for p in /proc/[0-9]*; do [ "$(cat $p/comm 2>/dev/null)" = llama-server ] && pid=${p#/proc/}; done
    pv() { awk -v k="$1:" "\$1==k{print \$2}" /proc/$pid/status; }
    echo "$(cat $cg/memory.current),$(cat $cg/memory.peak),$(st anon),$(st file),$(st file_mapped),$(st shmem),$(cat $cg/memory.swap.current),$(ev oom),$(ev oom_kill),$(ev high),$(ev max),$(pv VmRSS),$(pv RssAnon),$(pv RssFile),$(pv RssShmem),$(pv VmSwap)"
  ' 2>/dev/null) || line="container_unavailable"
  echo "$(date +%s%3N),$line" >> "$OUT"
  sleep "$IV"
done
