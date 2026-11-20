# Referenzmanifest – Referat Cloud Computing, Thema 2 (Gruppe 8)

> **Evidenzstatus:** Labor selbst gebaut (eigener Rechner, WSL2 + Docker Desktop).
> Evidenzstufe **„lokal verifiziert“**. Kein Prof-Labor, keine Produktionsmessung.
> Es wurden keine Werte aus `.env` oder `.env.*` übernommen. Flag-Defaults stammen
> ausschließlich aus Doku und Compose-Dateien des Referenzstands.

Erhoben am: 2026-11-17

## Referenzstand (Software)

| Merkmal            | Wert                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------- |
| Release            | **1.3.0** (`package.json` → `"version": "1.3.0"`)                                      |
| Referenz-Commit    | `efd71b44d4fd32d711cd483606ce5eefd1e9af5b` (Merge PR #654), 2026-11-07T16:40:03+01:00  |
| Begründung         | Letzter Commit auf `main` (first-parent) vor `40c62cb9 chore: prepare release 1.4.0`   |
| Arbeitsbranch      | `referat/thema2-gruppe8` = Referenz-Commit + nur `CLAUDE.md` / `referat/`              |
| Version-Bump 1.3.0 | `85ebdb8c` (2026-10-22), Release-Notes: `docs/releases/1.3.0.md`                       |
| Git-Tags           | keine im Repo vorhanden                                                                |

Bei jeder Messung zusätzlich `git rev-parse HEAD` des Arbeitsbranches in
`referat/evidenz/protokoll.md` notieren. Produktcode (`apps/`, `libs/`) entspricht dort
immer dem Referenz-Commit.

## Laufzeitumgebung

| Merkmal         | Wert                                                                    |
| --------------- | ----------------------------------------------------------------------- |
| Node.js         | v24.18.0                                                                |
| npm             | 11.16.0                                                                 |
| Docker          | Docker version 29.8.2, build 7fc2dff (Server 29.8.2, „Docker Desktop“)  |
| Host-OS         | Microsoft Windows 11 Home 10.0.26300                                    |
| WSL-Distribution| Ubuntu 26.04.1 LTS (Resolute Raccoon)                                   |
| WSL-Kernel      | 6.18.33.2-microsoft-standard-WSL2                                       |

## Hardware

| Merkmal                    | Wert                                                     |
| -------------------------- | -------------------------------------------------------- |
| CPU                        | AMD Ryzen 9 7950X3D 16-Core Processor                    |
| Kerne / Threads            | 16 Kerne, 2 Threads/Kern → 32 logische CPUs (1 Sockel)   |
| `nproc` (WSL)              | 32                                                       |
| `docker info` NCPU         | 32                                                       |
| RAM Host (Windows)         | 33.396.596.736 B (≈ 31,1 GiB)                            |
| RAM WSL (`free -b`)        | 16.288.276.480 B (≈ 15,2 GiB), Swap 4 GiB — **vor Anpassung** |
| RAM `docker info` MemTotal | 16.288.276.480 B (≈ 15,2 GiB) — **vor Anpassung**        |
| RAM WSL (`free -b`)        | 20.967.022.592 B (≈ 19,5 GiB), Swap 5.368.709.120 B (5 GiB) — **nach Anpassung** |
| RAM `docker info` MemTotal | 20.967.022.592 B (≈ 19,5 GiB; `docker info`: „19.53GiB“), NCPU 32 — **nach Anpassung** |
| WSL-Limit                  | `%UserProfile%\.wslconfig` → `[wsl2] memory=20GB` gesetzt am 2026-11-17; nach `wsl --shutdown` wirksam, erhoben 2026-11-17 |

Docker Desktop nutzt das WSL2-Backend, daher entspricht `docker info` MemTotal dem
WSL-VM-Speicher.

## Feature-Flags (Defaults laut Doku, Stand 1.3.0)

Kanonische Fundstelle: `docs/ENVIRONMENT.md` (Tabelle Umgebungsvariablen).
Alle Kill-Switches aktivieren nur bei exakt `true`.

### Textanalyse / NLP

| Variable                      | Default | Fundstelle                                  | Bemerkung                                                                 |
| ----------------------------- | ------- | ------------------------------------------- | ------------------------------------------------------------------------- |
| `NLP_ENABLED`                 | `false` | `docs/ENVIRONMENT.md:82`, `:348`; `docker-compose.yml:60` | spaCy-Glättung (Story 1.14b); zusätzlich Compose-Profil `nlp`; `deploy.sh` startet den Sidecar nicht |
| `WORD_CLOUD_SEMANTIC_ENABLED` | `false` | `docs/ENVIRONMENT.md:91`, `:363`; `docker-compose.yml:64` | Host-Q&A-/Freitext-Themen (1.14c/1.14d); Compose-Profil `encoder`         |

### Q&A-NLP-Kaskade (Story 8.9b)

| Variable                | Default | Fundstelle                | Bemerkung                                       |
| ----------------------- | ------- | ------------------------- | ----------------------------------------------- |
| `QA_NLP_ENABLED`        | `false` | `docs/ENVIRONMENT.md:97`, `:384` | Gatekeeper + k-NN-Fallback; getrennt von `NLP_ENABLED` |
| `QA_NLP_TIMEOUT_MS`     | `2000`  | `docs/ENVIRONMENT.md:98`  | Bereich 200–15.000 ms                           |
| `QA_NLP_QUEUE_LIMIT`    | `100`   | `docs/ENVIRONMENT.md:99`  | Bereich 1–1.000                                 |
| `QA_NLP_CONCURRENCY`    | `1`     | `docs/ENVIRONMENT.md:100` | Bereich 1–4                                     |
| `QA_NLP_MIN_CONFIDENCE` | `0.55`  | `docs/ENVIRONMENT.md:101` | Bereich 0.2–0.95                                |

### Moderationszusammenfassung (Story 8.9c)

| Variable                     | Default   | Fundstelle                | Bemerkung                                                    |
| ---------------------------- | --------- | ------------------------- | ------------------------------------------------------------ |
| `QA_SUMMARY_ENABLED`         | `false`   | `docs/ENVIRONMENT.md:102`, `:388` | V2-Fallback extraktiv ab drei sichtbaren Q&A-Beiträgen |
| `QA_SUMMARY_TIMEOUT_MS`      | `90000`   | `docs/ENVIRONMENT.md:103` | 500–300.000 ms; effektiv `max(…, OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_MS)` bei Full-Context |
| `QA_SUMMARY_QUEUE_LIMIT`     | `8`       | `docs/ENVIRONMENT.md:104` | 1–32                                                         |
| `QA_SUMMARY_CONCURRENCY`     | `1`       | `docs/ENVIRONMENT.md:105` | 1–2                                                          |
| `QA_SUMMARY_COOLDOWN_MS`     | `30000`   | `docs/ENVIRONMENT.md:106` | 5.000–120.000 ms                                             |
| `QA_SUMMARY_TTL_MS`          | `1800000` | `docs/ENVIRONMENT.md:107` | 60.000–28.800.000 ms                                         |
| `QA_SUMMARY_MAX_SOURCES`     | `20`      | `docs/ENVIRONMENT.md:108` | 3–40 (Legacy-Grenze)                                         |
| `QA_SUMMARY_INFERENCE_URL`   | leer      | `docs/ENVIRONMENT.md:109` | Lokaler Dev-Helfer `qa-summary:dev` (Gemini) ist **kein Nachweis** im Referat |
| `QA_SUMMARY_INFERENCE_TOKEN` | leer      | `docs/ENVIRONMENT.md:110` | Wert wird nie protokolliert                                  |

### Open-Weight-LLM-Runtime (Story 8.9d, llama.cpp)

| Variable                              | Default                                  | Fundstelle                         | Bemerkung                                       |
| ------------------------------------- | ---------------------------------------- | ---------------------------------- | ----------------------------------------------- |
| `OPEN_WEIGHT_LLM_ENABLED`             | `false`                                  | `docs/ENVIRONMENT.md:111`, `:392`  | Gemeinsamer Kill-Switch der privaten Runtime    |
| `OPEN_WEIGHT_LLM_URL`                 | leer                                     | `docs/ENVIRONMENT.md:112`          | nur Loopback/RFC1918/ULA zulässig               |
| `OPEN_WEIGHT_LLM_SOCKET_PATH`         | leer                                     | `docs/ENVIRONMENT.md:113`          | exklusiv zu `OPEN_WEIGHT_LLM_URL`               |
| `OPEN_WEIGHT_LLM_TOKEN`               | leer                                     | `docs/ENVIRONMENT.md:114`          | Wert wird nie protokolliert                     |
| `OPEN_WEIGHT_LLM_LABEL_TIMEOUT_MS`    | `30000`                                  | `docs/ENVIRONMENT.md:115`          | 1.000–300.000 ms                                |
| `OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_MS`  | `90000`                                  | `docs/ENVIRONMENT.md:116`          | 1.000–300.000 ms                                |
| `OPEN_WEIGHT_LLM_LEARNING_TIMEOUT_MS` | `300000`                                 | `docs/ENVIRONMENT.md:117`          | je Batch; Gesamtbudget 20 min                   |
| `OPEN_WEIGHT_LLM_MODEL_DIR`           | `./models/open-weight-llm`               | `docker-compose.yml:180`, `docker-compose.prod.yml:167` | Compose-Fallback                |
| `OPEN_WEIGHT_LLM_IMAGE`               | `arsnova-open-weight-llm:llama-b10524`   | `docker-compose.prod.yml:150`      | `docker-compose.llm.yml:8` verlangt Digest-Ref  |
| `OPEN_WEIGHT_LLM_BIND_ADDRESS`        | `127.0.0.1` (lokal)                      | `docker-compose.yml:221`           | Second-Host: `docs/operations/OPEN-WEIGHT-LLM-SECOND-HOST-RUNBOOK.md` |

Weitere `QA_NLP_*`/`QA_SUMMARY_*`/`OPEN_WEIGHT_LLM_*`-Bezeichner in `apps/backend/src`
sind Code-Konstanten (Grenzen, Vertragsversionen), keine Umgebungsvariablen, und
werden hier nicht als Flags geführt.

## Private LLM-Runtime 2C (Schritt 5.1, erhoben 2026-11-20)

Same-Host-Laborprofil `llm-http` aus `docker-compose.yml`, unverändert. Gebaut aus einem
LF-Export von `efd71b44` (`git -c core.autocrlf=false archive`), weil der Arbeits-Checkout
wegen `core.autocrlf=true` CRLF-Skripte enthält. Rohdaten: `referat/evidenz/2c/runtime/`.

| Merkmal | Wert |
| ------- | ---- |
| Modell | Qwen3-4B-Instruct-2507, Q4_K_M, Apache-2.0 (`docker/open-weight-llm/model-manifest.json`) |
| GGUF-Quelle | `unsloth/Qwen3-4B-Instruct-2507-GGUF` @ `a06e946bb6b655725eafa393f4a9745d460374c9` |
| GGUF-Digest | sha256 `3605803b982cb64aead44f6c1b2ae36e3acdb41d8e46c8a94c6533bc4c67e597`, 2.497.281.120 B (geprüft mit `verify-model.mjs` und im Entry-Point) |
| GGUF-Ablage | `~/models/open-weight-llm/` (außerhalb des Repos), per `OPEN_WEIGHT_LLM_MODEL_DIR` read-only nach `/models` |
| Basis-Image | `ghcr.io/ggml-org/llama.cpp:server-b10524@sha256:57e505f69c3a55fa5dd9c15fced47cff7a899f5b5b504ea93d75b2f401b87830` (`/props` → `build_info` `b10524-9ee9fc04c`) |
| Lokales Image | `arsnova-open-weight-llm:llama-b10524` = `sha256:cb50fb7fc83f3d795f4fd4e974e28536fbd6ee44161a4008400fdd5b1c3c12ab` (lokal gebaut; ID ändert sich je Build, frühere Builds `6f1957ce…`, `b33d33ac…`) |
| Serverparameter | `--ctx-size 8192`, `--parallel 1` (`total_slots` 1), `--n-predict 768`, `--threads 4`, `--threads-batch 4`, `--n-gpu-layers 0`, `--reasoning off`, `--jinja`, `--offline` (`docker/open-weight-llm/entrypoint.sh`; ctx und Slots per `/props` bestätigt) |
| Containerlimits | `mem_limit` 5 GiB (5.368.709.120 B), MemorySwap 10 GiB (Docker-Default 2×, in Compose nicht gesetzt), `cpus` 4.0, `pids_limit` 128, read-only, `cap_drop ALL`, `no-new-privileges`, `init`, tmpfs `/tmp` 128 MiB |
| Netz | `network_mode: host`, Bind `127.0.0.1:8080` (Docker Desktop „Host networking“ aktiviert). Erreichbar nur über `127.0.0.1`/`localhost`; WSL-eth0 und `[::1]` abgewiesen; Windows-Listener `127.0.0.1:8080`. API mit Bearer-Token (Compose-Default, nicht protokolliert), `/v1/models` ohne Token → 401 |
| Start bis healthy | 12 s (Image aus Cache; erster Build mit Pull ≈ 45 s) |

**Health-Probe** `health.openWeightLlmProbe` (live, Backend lokal mit `OPEN_WEIGHT_LLM_ENABLED=true`):
`overall: ok`, HTTP 200, 67,6 s gesamt; `topic_label` ok 5,3 s, `qa_summary` ok 48,3 s,
`learning_objectives` ok 14,0 s.

**Speicher während der Probe** (Maxima, 1-s-Sampling; Limit 5 GiB):

| Größe | Leerlauf vorher | Probe-Peak | Bedeutung |
| ----- | --------------: | ---------: | --------- |
| Prozess `RssAnon` (llama-server) | 2,82 GiB | **3,19 GiB** | tatsächlicher Prozessspeicher (KV-Cache, Puffer) |
| Prozess `RssFile` | 2,31 GiB | 2,31 GiB | per mmap eingeblendete GGUF-Seiten (Page Cache) |
| Prozess `VmRSS` (Summe) | 5,13 GiB | 5,50 GiB | übersteigt das Limit, weil die GGUF-Seiten nicht dem Container-cgroup angerechnet werden |
| cgroup `anon` / `file` / `file_mapped` | 2,83 / 0,24 / 0,21 GiB | 3,20 / 0,24 / 0,21 GiB | dem Limit angerechnet |
| cgroup `memory.current` / `memory.peak` | 3,08 / 3,13 GiB | 3,45 / **3,46 GiB** | `peak` seit Containerstart |
| `docker stats` MemUsage | 2,94 GiB | **3,31 GiB** | `current` abzüglich `inactive_file` |
| Swap (`memory.swap.current`, `VmSwap`) | 0 | **0** | |
| OOM (`memory.events` oom/oom_kill/max/high) | 0 | **0** | `OOMKilled=false`, 0 Restarts |
| CPU (`docker stats`) | 6 % | 403 % | Limit 4 CPUs ausgeschöpft |

Hinweis: Im ersten Start (Versuch 2, vor dem Docker-Neustart) waren 2,27 GB `file_mapped`
dem cgroup angerechnet, `memory.peak` erreichte das Limit (5 GiB) und 11,7 MB lagen im Swap.
Die Ursache des Unterschieds (Page-Cache-Zuordnung unter Docker Desktop) ist nicht geklärt.
Für Aussagen zum Limit zählt `RssAnon`/cgroup `anon`.
