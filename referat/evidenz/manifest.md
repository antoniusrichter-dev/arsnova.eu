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
