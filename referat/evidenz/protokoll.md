# Messprotokoll – Referat Thema 2 (Gruppe 8)

Hardware/Software: siehe `referat/evidenz/manifest.md` (Ryzen 9 7950X3D, 32 log. CPUs,
WSL-RAM 19,5 GiB nach Anpassung). Produktcode = Referenz-Commit `efd71b44`.

---

## Phase 2 / Schritt 2.1 – Basis-Stack (Entwicklungsmodus)

- Datum: 2026-11-17
- HEAD Arbeitsbranch: `52b352826a810676dcb1e0110e130bea8f7f27c9`
- Flags: keine Overrides (Defaults laut Manifest; NLP/QA-NLP/Summary/LLM aus)
- Quelle des Ablaufs: `docs/onboarding.md` §1 Quickstart, Root-`package.json`

| # | Befehl | Ergebnis |
|---|--------|----------|
| 1 | `node -v` | v24.18.0 (passt zu `.nvmrc`) |
| 2 | `python3 --version` | 3.14.4 – laut Onboarding für spaCy (`npm run dev`) zu neu (3.10–3.13 nötig). Daher **kein** `npm run dev`, sondern Basis-Stack einzeln (`dev:backend`, `dev:frontend`); spaCy/Encoder gehören nicht zum Basis-Stack. |
| 3 | `test -f .env` | vorhanden (Inhalt nicht gelesen/protokolliert) |
| 4 | `docker ps` | `arsnova-v3-postgres` und `arsnova-v3-redis` healthy; zusätzlich alter Container `arsnova-v3-app` (Image `arsnovaeu-app`, erstellt 2026-10-09, `restart=always`) im Neustart-Loop: `exec /app/scripts/docker-entrypoint.sh: no such file or directory`; belegt Host-Ports 3000–3002 (alle Interfaces). |
| 5 | `npm ci` | exit 0, 7 min 17 s, 1858 Pakete (Log: `labor/npm-ci.log`). npm 11.16 blockiert Install-Skripte von 10 Paketen (`allowScripts` nicht gesetzt): @parcel/watcher, @playwright/browser-chromium, @prisma/engines, esbuild, leveldown, lmdb, msgpackr-extract, prisma, protobufjs, unix-dgram. Nicht freigegeben (würde `package.json` ändern). |
| 6 | `npm run prisma:migrate` | **exit 1**, `P1001: Can't reach database server at localhost:5432` (2 Versuche; Logs `labor/prisma-migrate*.log`, URL geschwärzt) |
| 7 | `npm run prisma:generate` | exit 0 |
| 8 | `npm run build:libs` | exit 0 (shared-types, session-export-report) |

### Diagnose P1001 (2026-11-17, nach `wsl --shutdown`)

- `node-postgres` mit `DATABASE_URL` → `ECONNRESET` (auch mit Host 127.0.0.1).
- Rohes TCP auf 127.0.0.1:5432 aus WSL: Verbindung angenommen, keine Antwort auf SSLRequest, dann Reset.
- Postgres-Log: kein Verbindungsversuch angekommen.
- Im Container `pg_isready -h 127.0.0.1` → accepting; pg_hba/`listen_addresses='*'` unauffällig.
- Hilfscontainer `postgres:16-alpine`: über Compose-Netz `arsnovaeu_default` → accepting; `--network host` 127.0.0.1:5432 → accepting; `host.docker.internal:5432` → no response.
- Gegenprobe: Redis 6379 aus WSL → `+PONG`; frischer Testcontainer `nginx:alpine` auf 127.0.0.1:18080 → HTTP 200 (danach entfernt).
- Windows-Seite: kein natives Postgres; 5432 gehört `com.docker.backend` (::) und `wslrelay` (::1).
- Befund: Portweiterleitung Docker Desktop → WSL-Distribution nur für den Postgres-Port 5432 defekt (vermutlich veraltet nach WSL-Neustart). **Gestoppt, Rückfrage beim Nutzer.**

---

## Phase 3 / Schritt 3.1 – 2A Regelkern über Raumgrößen

- Datum: 2026-11-17
- HEAD Arbeitsbranch: `52b352826a810676dcb1e0110e130bea8f7f27c9` (Produktcode = `efd71b44`)
- Flags: keine (reiner Regelkern ohne Backend/DB)
- Hardware: siehe Manifest
- Befehl: `npx vitest run --config referat/2a/vitest.config.ts regelkern-raumgroessen` → 2/2 Tests grün (Vitest 4.1.10)
- Selbstprüfung: SQL-Nachrechnung (bestScore, controversyScore) = Produkt-Referenzwerte N=200 auf 12 Stellen
- Ergebnis: `referat/evidenz/2a/baseline-raumgroessen.{json,md}`
- Abgleich Plan §0.2: 1 Abweichung – K(A) bei P=1000 Plan 0,27, Ist 0,2857 (60/210) → 0,29
- Hinweis: Fixture-Seed (2.2) und Backend noch nicht verfügbar (P1001, siehe oben)

### Nachtrag Schritt 2.1 – Postgres-Neustart (freigegeben vom Nutzer)

| # | Befehl | Ergebnis |
|---|--------|----------|
| 9 | `docker compose restart postgres` | Container `arsnova-v3-postgres` neu gestartet, nach 6 s `healthy`; keine Volumes/Daten gelöscht |
| 10 | node-postgres mit `DATABASE_URL` | `select 1` ok → Portweiterleitung 5432 wieder intakt |
| 11 | `npm run prisma:migrate` (3. Versuch) | exit 0, „All migrations have been successfully applied.“ (Log `labor/prisma-migrate-3.log`) |

---

## Phase 3 / Schritt 3.4 – 2A Aufwand (Microbenchmark)

- Datum: 2026-11-17
- HEAD Arbeitsbranch: `52b352826a810676dcb1e0110e130bea8f7f27c9` (Produktcode = `efd71b44`)
- Flags: keine (In-Process, ohne Backend/DB); Node v24.18.0 mit `--expose-gc`
- Hardware: Ryzen 9 7950X3D, 32 log. CPUs, WSL2 (Manifest); Messung Single-Thread, kein CPU-Pinning, Hintergrundlast (Docker Desktop, Postgres/Redis idle) nicht abgeschaltet
- Befehl: `node --expose-gc --import tsx referat/2a/bench/aufwand.bench.ts` → exit 0, Gesamtlaufzeit 4,3 s
- Parameter: N = 50/500/2500, 5 Warm-up, 30 Wiederholungen, P = 200 für Kartenbildung, Seed 0x2a2a2a2a + N
- Ergebnis: `referat/evidenz/2a/aufwand.{md,csv}`, Rohdaten `aufwand-roh.csv`
- Kurz: Kartenbildung Median 42 µs (N=50) → 400 µs (N=2500); Fallback Median 114 µs → 498 µs; alles unter 1 ms (p95 ≤ 0,69 ms)

---

## Phase 3 / Schritt 3.5 – 2A Rubrikbogen

- Datum: 2026-11-17 · keine Messung, nur Bogen
- Ergebnis: `referat/evidenz/rubrik.md` (K1–K5, 0–2 Punkte, Anker aus der Fixture A–F und der 3.1-Baseline; leere Bögen für Person 1/2: Regelkern, Extraktion, ungefilterte Fragenliste)
- Bewertung **nicht** ausgefüllt (Eigenleistung)

---

## Phase 3 / Schritt 3.2 – 2A Gegenfälle

- Datum: 2026-11-17
- HEAD Arbeitsbranch: `52b352826a810676dcb1e0110e130bea8f7f27c9` (Produktcode = `efd71b44`)
- Flags: keine; P = 50 (T = 5); `.env` per dotenv nur für den Modulimport von `db.ts` geladen (Wert nicht ausgegeben, kein DB-Zugriff im Test)
- Befehl: `npx vitest run --config referat/2a/vitest.config.ts gegenfaelle` → 9/9 grün
- Erwartungen vor der Ausführung als Kopfkommentar in `referat/2a/gegenfaelle.test.ts` notiert
- Ergebnis: `referat/evidenz/2a/gegenfaelle.{md,json}` – alle Fälle wie erwartet, keine Abweichung

---

## Entscheidung P = 50 und Fall „P50-skaliert“ (2026-11-20)

- Vorgabe der Gruppe: keine direkt gesetzten Zähler, kein ausgesetzter Trigger. Echte Stimm-Zeilen für P = 200/500/1000; P = 50 als eigener Fall „P50-skaliert“ (Stimmen proportional verkleinert)
- Präzisierung: Autor:innen dürfen die eigene Frage nicht bewerten (`apps/backend/src/routers/qa.ts:345`), daher höchstens P − 1 Stimmen je Frage → Fixture erst ab P ≥ 111 konsistent (nicht 110)
- Faktor f = ⌊10 · 49 / 110⌋ / 10 = 0,4 → A 32/12, B 4/0, C 12/0, D 5/0 (4,8 gerundet), E 16/16, F 8/8
- Befehl: `npx vitest run --config referat/2a/vitest.config.ts regelkern-raumgroessen p50-skaliert` → 3/3 grün
- Ergebnis: `referat/evidenz/2a/p50-skaliert.{md,json}`; Hinweis in `baseline-raumgroessen.md` ergänzt (Zeile P = 50 rechnerisch, nicht realisierbar)
- Befund: Bei P50-skaliert ist A nicht mehr umstritten (K 0,5217 → 0,4898, Badge onesided); B fällt unter T (4 < 5). Reibungskarte nur noch [E, F]

---

## Labor: alter App-Container angehalten (2026-11-20)

- `arsnova-v3-app` (Compose-Projekt arsnovaeu) in Neustartschleife, Exit 255, Ursache laut Log: `exec /app/scripts/docker-entrypoint.sh: no such file or directory`; belegt bei Startversuchen 3000–3002
- Nach Freigabe: `docker stop arsnova-v3-app` (kein rm, Volumes unverändert; Postgres/Redis laufen weiter) → `referat/evidenz/labor/app-container-stop.log`

---

## Phase 2 / Schritt 2.2 – Seed Sechs-Fragen-Szenario

- Datum: 2026-11-20
- HEAD vor Seed: `52b352826a810676dcb1e0110e130bea8f7f27c9`; Seed committet als `905250f2` (nur `referat/fixtures/{sechs-fragen-szenario.json,seed-sechs-fragen.ts,README.md}`)
- Backend: `npm run dev:backend` (Default-Flags aus `.env`, Werte nicht protokolliert), tRPC `http://127.0.0.1:3000/trpc`
- Hardware: siehe Manifest
- Ablauf: Session über `session.create`, optionales Lernziel über `session.saveLearningObjectives`, Teilnehmende/Fragen/QaUpvote-Zeilen per Prisma, Zähler nur durch Trigger; Host-Token nur in `referat/.local/` (gitignored, 0600)

| # | Befehl | Ergebnis |
| -: | ------ | -------- |
| 1 | `npx tsx referat/fixtures/seed-sechs-fragen.ts --p {50 --skaliert,200,500,1000} --dry-run` | Sollwerte wie erwartet; `--p 50` ohne `--skaliert` bricht ab (exit 1) |
| 2 | `… --p 50 --skaliert --lernziel` (1. Versuch) | Fehler im Seed-Skript (Lernziel-DTO-Feld `id` statt `objectiveId` gelesen); Session VKKU2E ohne Fragen bleibt als Rest liegen. Skript korrigiert |
| 3 | `… --p 50 --skaliert --lernziel --out referat/evidenz/seed/pruefpunkt-p50-skaliert.json` | Session 4HP8T2, 50 TN, 113 Stimm-Zeilen, Lernziel confirmed, Prüfung ok |
| 4 | `… --p 200 --out …/pruefpunkt-p200.json` | Session 6X3D44, 200 TN, 282 Stimm-Zeilen, Prüfung ok, 12,1 s |
| 5 | `… --p 500 --out …/pruefpunkt-p500.json` | Session XEA84G, 500 TN, 282 Stimm-Zeilen, Prüfung ok, 12,3 s |
| 6 | `… --p 1000 --out …/pruefpunkt-p1000.json` | Session U3V79P, 1000 TN, 282 Stimm-Zeilen, Prüfung ok, 12,7 s |

- Prüfpunkt Runbook („P = 50 erzeugt 6 Fragen mit richtigen Stimmen“): erfüllt für den Fall P50-skaliert (6 Fragen ACTIVE, Zähler = skalierte Sollwerte); die unskalierten Fixture-Stimmen sind bei P = 50 nicht realisierbar (siehe oben)
- `grep hostToken referat/evidenz/` → kein Treffer
- Commit: Pre-commit-Hook scheitert an lint-staged 17.2.0 (`--concurrent false` → „Invalid value for option 'concurrent': NaN“). Nach Freigabe: Hook-Schritte manuell auf die drei Pfade (`prettier --write/--check`, `eslint --no-warn-ignored`; eine `any`-Typisierung im Seed behoben), dann `git commit --no-verify`. `test:related` nicht ausgeführt (keine Produkttests zu `referat/`). Hook und package.json unverändert

---

## Phase 2 / Schritt 2.1 – Abschluss: Backend, Frontend, Smoke-Test (2026-11-20)

- HEAD: `905250f2` (Produktcode = `efd71b44`); Flags: Defaults aus `.env` (nicht protokolliert); Hardware: Manifest

| # | Befehl | Ergebnis |
| -: | ------ | -------- |
| 12 | `npm run dev:backend` (Hintergrund) | Migration geprüft (104), MOTD-Seeds, Ports 3000–3002 frei; Backend `http://localhost:3000`, tRPC `/trpc`, WS 3001, Yjs 3002; `health.check` 200 → `labor/dev-backend-start.log` |
| 13 | `PARTICIPANTS=5 HOST_PIN_COUNT=1 HOST_ARCHIVE_COUNT=1 HOST_DELETE_COUNT=1 TRPC_URL=http://127.0.0.1:3000/trpc REPORT_FILE=referat/evidenz/labor/smoke-qa-classroom.json node scripts/load/qa-classroom-30.mjs` | exit 0, „bestanden“: Session 44PHA3 angelegt, 5 Joins, 15/15 Fragen eingereicht (p95 161 ms), 30/30 Stimmen angenommen, Pin/Archiv/Löschen 3/3, Host-Liste 14 sichtbar wie erwartet → `labor/smoke-qa-classroom.{json,log}` (kein Token enthalten) |
| 14 | `npm run dev:frontend` (Hintergrund) | Bundle in 44,8 s, `http://localhost:4200/` liefert 200 → `labor/dev-frontend-start.log` |

- Prüfpunkt 2.1: App läuft auf localhost, Smoke-Test grün (über das vorhandene Lastskript, nicht über die UI)

---

## Phase 3 / Schritt 3.3 – 2A Extraktiver Fallback im Releasepfad (2026-11-20)

- HEAD `905250f2` (Produktcode = `efd71b44`); Hardware: Manifest
- Flags: `QA_SUMMARY_ENABLED=true OPEN_WEIGHT_LLM_ENABLED=false QA_SUMMARY_INFERENCE_URL=` (leer), Störung a zusätzlich `QA_SUMMARY_QUEUE_LIMIT=1`; übrige Werte Defaults aus `.env` (nicht protokolliert). Backend direkt `cd apps/backend && <Flags> npx tsx src/index.ts` (ohne watch, ohne Migrationsschritt), dreimal neu gestartet (Haupt / Queue-Limit 1 / Störung b)
- Skript: `referat/2a/fallback/fallback-lauf.ts` (Modi `haupt`, `queue-full`, `source-changed`)

| # | Befehl | Ergebnis |
| -: | ------ | -------- |
| 1 | `npx tsx referat/2a/fallback/fallback-lauf.ts haupt --seed referat/evidenz/seed/pruefpunkt-p200.json --fall P200` | ready, extractive, `disabled`, 3 Aussagen, Quellen F/E/C 3/3 |
| 2 | `… haupt --seed …/pruefpunkt-p500.json --fall P500` | ready, extractive, `disabled`, Quellen D/E/C 3/3 |
| 3 | `… haupt --seed …/pruefpunkt-p50-skaliert.json --fall P50-skaliert` | ready, extractive, `disabled`, Quellen F/E/C 3/3 |
| 4 | `… queue-full --seed …p200.json --seed …p500.json --runden 5` (Queue-Limit 1) | Runde 1 `queue_full`; Runden 2–5 Cooldown-Cache |
| 5–6 | dasselbe mit `--runden 1`, jeweils nach 35 s | je einmal `queue_full` (3/3 Läufe gesamt) |
| 7 | `… source-changed --seed …p200.json --frage F` (parallel, 1. Fassung) | Fehler „Host-Session ungültig oder abgelaufen.“ – Host-Token-TTL 15 min, Sessions von 09:24 |
| 8 | `npx tsx referat/fixtures/seed-sechs-fragen.ts --p 200 --out referat/evidenz/seed/stoerung-b-p200.json` | Session MNS434, Prüfung ok |
| 9 | `… source-changed --seed …/stoerung-b-p200.json --frage F` (parallel) | `requestSummary` abgebrochen: „Der autorisierte Q&A-Kontext hat sich während des Aufbaus geändert.“; F gelöscht |
| 10 | `… --frage F --loeschung nach-pending` | pending, Löschung „Frage nicht gefunden.“ (F bereits gelöscht) |
| 11 | `… --frage E --loeschung nach-pending` | Cooldown-Cache, keine Löschung |
| 12 | dasselbe nach 32 s | pending → E gelöscht → **source_changed** (über `context_unavailable` im Job, dann Frisch-Pfad in `summaryRuntime`) |

- Ergebnis: `referat/evidenz/2a/fallback/ergebnis.md`, Rohantworten `*.json`, Backend-Logs ohne Token `backend-*.log`
- Befund: Summary-Kontext enthält bei < 100 Fragen nur 3 Fragen (`trimSummaryAnalysisQuestions`); bei P200 fehlen A, B, D
- Token-Check: kein Host-Token in `referat/evidenz/`

---

## Nachtrag 3.3 / 3.4 (2026-11-20)

- `referat/evidenz/2a/aufwand.md`: Einordnung korrigiert. Die Kurzfassung ist durch `trimSummaryAnalysisQuestions` auf 3 bzw. 16 Fragen begrenzt (nicht 40). Messwerte unverändert
- Produkttest-Beleg für `source_changed`: `cd apps/backend && npx vitest run src/lib/qaSummaryQueue.test.ts -t "verwirft generative Ausgabe …|revalidiert ein fertiges Ergebnis …"` → 2 passed, 10 skipped → `referat/evidenz/2a/fallback/produkttest-source-changed.log`. Der Zweig im Job ist nur per Unit-Test mit Mocks belegt, im Labor nicht getroffen
- `fallback/ergebnis.md`: 3-Fragen-Kürzung als Befund 1 (fehlende Fragen je Fall, Codestellen, Begründung A/B)
- Backend (3.3-Flags) gestoppt; Frontend-Dev-Server (4200) läuft weiter

---

## Phase 4 / Schritt 4.1 – 2B Referenzmenge (2026-11-20)

- HEAD `905250f2`; keine Messung, kein Backend
- Befehl: `python3 -I referat/2b/referenz_erzeugen.py` → `referat/2b/referenz.csv` (80 Zeilen; de 36 inkl. 6 Fixture, en 24, fr 10, es 10; Gruppen fixture 6, kurz 14, paraphrase 21, tippfehler 11, slang 11, mehrdeutig 17; beide Labelspalten leer, per csv-Parser geprüft)
- Abgleich gegen `apps/backend/src/lib/qaNlpSeed.ts` (186 Texte): kein identischer Text, keine Ähnlichkeit ≥ 0,75 außer Fixture C (0,79, bleibt wörtlich). Vier Vorschläge vorher ersetzt (einer war identisch mit einem Seed-Text: „Geht das auch anders?“) → `referat/evidenz/2b/seed-abgleich.json`
- `referat/2b/labelregeln.md`: Werte und Belege aus `docs/features/qa-nlp-moderation.md`, ADR-0032, Frontend-Texten und der Referenz-Fixture. Die Doku enthält keine ausformulierte Abgrenzung; die Operationalisierung ist als Vorschlag für die Gruppe gekennzeichnet
- Labels nicht vergeben (Eigenleistung)

---

## Phase 5 / Schritt 5.1 – 2C Private Runtime (2026-11-20) – ABGEBROCHEN

- HEAD `905250f2` (Produktcode = `efd71b44`); Hardware: Manifest; Docker Engine 29.8.2 (`docker info`: 32 CPUs, 20 967 022 592 B RAM)
- Frontend-Dev-Server (4200) vorher gestoppt
- GGUF außerhalb des Repos: `~/models/open-weight-llm/Qwen3-4B-Instruct-2507-Q4_K_M.gguf`
  - Download 10:34:40–10:38:40 (239,8 s), URL aus `docker/open-weight-llm/model-manifest.json` (Revision `a06e946bb6b655725eafa393f4a9745d460374c9`)
  - `node scripts/open-weight-llm/verify-model.mjs docker/open-weight-llm/model-manifest.json ~/models/open-weight-llm/Qwen3-4B-Instruct-2507-Q4_K_M.gguf` → verified 2 497 281 120 B, sha256:`3605803b982cb64aead44f6c1b2ae36e3acdb41d8e46c8a94c6533bc4c67e597`
- Start 10:38:54: `OPEN_WEIGHT_LLM_MODEL_DIR=$HOME/models/open-weight-llm npm run docker:up:llm:http` (Token = Compose-Default, nicht protokolliert)
  - Build ok: lokales Image `arsnova-open-weight-llm:llama-b10524` = `sha256:6f1957ce31f3acd0caabeb8c153c1c37fbdc2aeebe4128c7d777be30020df443`, Basis `ghcr.io/ggml-org/llama.cpp:server-b10524@sha256:57e505f6…7830`
  - **Fehler:** Container in Restart-Schleife (6 Restarts): `[FATAL tini (7)] exec /opt/arsnova/entrypoint.sh failed: No such file or directory`
  - Ursache: `core.autocrlf=true` in `.git/config`; `git ls-files --eol docker/open-weight-llm/` → `i/lf w/crlf` für alle `*.sh`, Shebang `#!/bin/sh\r` im Image
- Container gestoppt (`docker compose --profile llm-http stop open-weight-llm-http`). Keine Health-Probe, keine RAM-Messung. Manifest nicht ergänzt
- Kein Workaround angewendet, wartet auf Entscheidung

### Nachtrag 5.1 – zweiter Versuch aus LF-Export (2026-11-20) – ANGEHALTEN

- Ursache Versuch 1: CRLF durch `core.autocrlf=true` (repo-lokal in `.git/config`); gilt auch für Worktree/`git archive` ohne Override
- LF-Export außerhalb des Repos: `mkdir ~/arsnova-llm-runtime; git -c core.autocrlf=false archive efd71b44 | tar -x -C ~/arsnova-llm-runtime`
  - Prüfung: `file docker/open-weight-llm/*.sh` → alle vier „POSIX shell script, ASCII text executable“ (ohne CRLF); `grep -c $'\r'` → 0 je Datei
- Produktcode im Repo unverändert; Runtime aus LF-Export von `efd71b44` gebaut. Alter Container aus Versuch 1 entfernt (`docker rm`, gleicher `container_name`)
- Start 12:10:21 in `~/arsnova-llm-runtime`: `OPEN_WEIGHT_LLM_MODEL_DIR=$HOME/models/open-weight-llm npm run docker:up:llm:http`
  - Image `arsnova-open-weight-llm:llama-b10524` = `sha256:b33d33ac13426dd4fefdc5d1e9061f702d7b8aaf4e85eb2901f0af54d423e2d8`
  - healthy nach 16 s, 0 Restarts; im Container `curl http://127.0.0.1:8080/health` → 200
  - `docker inspect`: `network_mode=host`, Memory 5 GiB, MemorySwap 10 GiB (Docker-Default 2×, in Compose nicht gesetzt), 4,0 CPUs, pids 128, read-only, cap_drop ALL, no-new-privileges, init, tmpfs /tmp 128m, Mount `~/models/open-weight-llm:/models:ro`
  - Speicher direkt nach Start (cgroup v2, `memory.stat`): anon 3 025 653 760 B, file_mapped 2 272 522 240 B; `memory.current` 5 367 238 656 B ≈ Limit, `memory.peak` = 5 368 709 120 B (= Limit), `memory.swap.current` 11 661 312 B; `docker stats` 4,957 GiB / 5 GiB
- **Befund/Blocker:** Docker Desktop (`docker info`: Operating System „Docker Desktop“). `network_mode: host` bindet im Docker-Desktop-VM, nicht in WSL: von WSL `curl 127.0.0.1:8080` → connection refused. Laut `docs/onboarding.md` muss unter Docker Desktop Windows „Host networking“ aktiviert sein (Settings → Resources → Network). Keine Health-Probe, keine Peak-RAM-Messung unter Probe, Manifest nicht ergänzt
- Container gestoppt; wartet auf Docker-Desktop-Einstellung

### Nachtrag 5.1 – dritter Versuch, abgeschlossen (2026-11-20)

- Ursache der Abbrüche: (1) CRLF durch `core.autocrlf=true` → Runtime aus LF-Export von `efd71b44` (`~/arsnova-llm-runtime`) gebaut, Produktcode im Repo unverändert; (2) Docker Desktop ohne Host networking → vom Nutzer aktiviert, Docker Desktop neu gestartet
- Start 12:22:16 in `~/arsnova-llm-runtime`: `OPEN_WEIGHT_LLM_MODEL_DIR=$HOME/models/open-weight-llm npm run docker:up:llm:http` → healthy nach 12 s, 0 Restarts; Image `sha256:cb50fb7f…12ab` (neu gebaut nach Docker-Neustart)
- Erreichbarkeit (ohne Token, `/health`): `127.0.0.1:8080` 200, `localhost:8080` 200, WSL-eth0 `:8080` refused, `[::1]:8080` refused; Windows `Get-NetTCPConnection -LocalPort 8080` → nur `127.0.0.1`; `/v1/models` ohne Token 401, mit Token Alias `qwen3-4b-instruct-2507-q4_k_m`; `/props`: `total_slots` 1, `n_ctx` 8192, `build_info` b10524-9ee9fc04c
- Backend 12:23: `cd apps/backend && OPEN_WEIGHT_LLM_ENABLED=true OPEN_WEIGHT_LLM_URL=http://127.0.0.1:8080 OPEN_WEIGHT_LLM_SOCKET_PATH= OPEN_WEIGHT_LLM_TOKEN=<Compose-Default, aus docker-compose.yml gelesen, nicht protokolliert> OPEN_WEIGHT_LLM_LABEL_TIMEOUT_MS=30000 OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_MS=90000 OPEN_WEIGHT_LLM_LEARNING_TIMEOUT_MS=300000 QA_SUMMARY_ENABLED=true QA_SUMMARY_INFERENCE_URL= npx tsx src/index.ts` (Timeouts explizit auf Doku-Defaults, damit `.env`-Werte nicht greifen; übrige Werte aus `.env`, nicht protokolliert). Backend-HTTP lauscht produktbedingt auf allen Interfaces, WS auf `0.0.0.0:3001/3002`; Aufrufe nur über `127.0.0.1`. Log redigiert: `2c/runtime/backend-5.1.log`
- Sampler: `referat/2c/runtime/mem-sampler.sh` (1 s, cgroup v2 `memory.stat/current/peak/swap.current/events` + `/proc/<llama-server>/status`) → `2c/runtime/mem-probe.csv`; `referat/2c/runtime/stats-sampler.sh` (`docker stats`-Stream) → `2c/runtime/docker-stats-probe.csv`; 10 s Leerlauf vor und nach der Probe
- Probe 12:24:02: `curl http://127.0.0.1:3000/trpc/health.openWeightLlmProbe` (ohne Input, erster Aufruf = live) → HTTP 200, 67 643 ms, `overall: ok`; topic_label 5 349 ms, qa_summary 48 264 ms, learning_objectives 14 009 ms → `2c/runtime/probe-antwort.json`
- Speicher (Peak während der Probe): RssAnon 3,19 GiB, RssFile (mmap-GGUF) 2,31 GiB, VmRSS 5,50 GiB; cgroup anon 3,20 GiB, `memory.peak` 3,46 GiB; `docker stats` 3,31 GiB; Swap 0; oom/oom_kill 0 → `2c/runtime/zusammenfassung-5.1.json`, Manifest Abschnitt „Private LLM-Runtime 2C“
- Zwischenfall: `pkill -f` im Aufräumteil traf die eigene Shell (Exit 144) nach Ende der Probe; Probe und Sampler-Dateien vollständig (0 Zeilen `container_unavailable`), keine Sampler-Prozesse übrig
- Danach: Backend gestoppt (kill per PID von Port 3000); Runtime läuft weiter (healthy) für 5.2
- Token-Check: Token-Wert in `referat/` nicht gefunden

---

## Entscheidung: keine Zweitbewertung (2026-11-20)

- Entscheidung der Gruppe: Jede Person bewertet allein; kein zweiter Bewerter, kein Cohen's κ. Frühere Protokolleinträge bleiben unverändert
- Suche in `referat/` und `CLAUDE.md` nach „Person 2“, „label_person2“, „zweite Person“, „blind“, „κ“, „Kappa“, „Einigung“, „unabhängig“, „beide Personen“: Treffer nur in `referat/2b/labelregeln.md` (Z. 3, 53, 54) und `referat/2b/referenz_erzeugen.py` (Header/Zeilen)
- `referat/2b/referenz.csv`: Spalte `label_person2` war bereits nicht mehr vorhanden (Header `id,text,sprache,gruppe,label_person1`); Datei unverändert, sha256 vorher = nachher `c330fa9c190fd568d1569d5967b5b5346d5963fba356d3e8d64104bf1013aad5`
- `referat/2b/labelregeln.md`: Z. 3 auf eine Spalte/eine Person, Ablauf ohne κ/Einigung (4 → 3 Schritte), neuer Abschnitt „Grenzen“; Notiz-Tabelle unverändert
- `referat/2b/referenz_erzeugen.py`: `label_person2` aus Header und Zeilen entfernt; Überschreibschutz (Abbruch mit Exit 1, wenn `referenz.csv` existiert, außer `--force`); getestet: Abbruch, CSV danach byte-identisch
- `referat/evidenz/rubrik.md`: keine Tabellen „Person 2“/„Einigung“ vorhanden; nur Grenzsatz unter dem Bogen ergänzt. Bisheriger Inhalt byte-identisch als Präfix, Bogenabschnitt sha256 `d126efc1aadfbfefd89340b19a9be39635da4740422e9415d951c9659b7096b3` vorher = nachher
- 2C: noch keine Bewertungsbögen (Quellentreue-Bogen erst in 5.4, dann mit einer bewertenden Person)

## Gesamtprüfung vor den Commits (2026-11-20)

- HEAD `905250f2`; Befehl `npx vitest run --config referat/2a/vitest.config.ts regelkern-raumgroessen gegenfaelle p50-skaliert`
  - Lauf 1 (14:13:31): **1 failed / 11 passed** (Fehler in `gegenfaelle.test.ts` am dynamischen Import `apps/backend/src/lib/moderationTeachingSignals`, Ausgabe nur gekürzt gesichert, Meldung nicht erhalten)
  - `gegenfaelle` einzeln: 9/9 grün; danach Gesamtlauf 3× wiederholt: je 12/12 grün
- **Zwischenfall:** Die Tests schreiben ihre Ergebnisdateien neu. Überschrieben (sha256 vorher → nachher Lauf 1):
  - `2a/baseline-raumgroessen.json` `ac97ec81…` → `86b6dcdb…`; `2a/baseline-raumgroessen.md` `17ef5a3c…` → `5f1dbfca…`
  - `2a/gegenfaelle.json` `cf119de3…` → `d74e13c0…`; `2a/gegenfaelle.md` `ffedd6d1…` → `4c723462…`
  - `2a/p50-skaliert.md` `74f5e427…` → `e1324e2e…`; `2a/p50-skaliert.json` unverändert
  - Zwischen den Wiederholungsläufen ändert sich nur die Zeile „Erzeugt“; `gegenfaelle.json` (ohne Zeitfeld) weicht aber auch inhaltlich vom Stand vor dem Lauf ab. Alter Inhalt nicht gesichert, Ursache offen
- `referat/2b/referenz.csv`: 80 Datenzeilen, IDs R001–R080 lückenlos, jede Zeile genau ein gültiges Label (organization 41, content 25, technical 14); Fixture R001/R002 content, R003–R006 organization; Paraphrase-Paare einheitlich gelabelt
- `referat/evidenz/rubrik.md`: 3 Zeilen, alle K1–K5 im Bereich 0–2, Summen 5/4/5 korrekt
- Secret-Check `referat/` + `CLAUDE.md` (GNU grep, ohne `referat/.local`): Compose-Default-Token 0, Werte aus `.env` (≥ 12 Zeichen) 0, Muster Bearer/sk-/ghp_/AKIA/Private Key/JWT 0, Host-Tokens aus `referat/.local/` außerhalb 0; `2c/runtime/backend-5.1.log` ohne Token-/Bearer-Zeilen; `referat/.local/` per eigener `.gitignore` (`*`) ignoriert (`git check-ignore` bestätigt)

### Nachtrag Gesamtprüfung – inhaltlicher Abgleich 2A und Schreibschalter (2026-11-20)

- Inhaltlicher Abgleich des aktuellen Stands `referat/evidenz/2a/` mit den Ergebnissen aus 3.1/3.2/P50-skaliert: **keine inhaltliche Änderung**
  - `baseline-raumgroessen`: T = 5/20/50/100; P50 Reibung [E, F, A]; P200 Reibung [E, F], B und D insufficient; P500 Reibung [E]; P1000 keine Karte, kein nächster Schritt, K(A) = 0,2857; nächster Schritt jeweils controversy (attach=false)
  - `gegenfaelle`: alle 9 Fälle „wie erwartet“, u. a. Fall 1 E PENDING → Klärung, pending-qa; Fall 3 G (ohne Stimmen) und H (0/0) ununterscheidbar; Fall 5a `not-released`
  - `p50-skaliert`: K(A) = 0,4898 (≈ 0,49, onesided), Reibung nur [E, F]
- `gegenfaelle.json` feldweise (1015 Blätter) über drei Wiederholungsläufe verglichen: 0 abweichende Felder, keine Zeit-/ID-/Reihenfolgefelder. Aktueller Stand sha256 `cf119de3…` = **byte-identisch mit dem Stand vor der Gesamtprüfung**. Der abweichende Wert `d74e13c0…` trat nur direkt nach Lauf 1 auf, in dem ein Test fehlschlug; jeder grüne Lauf schreibt die ursprüngliche Datei
- Schwankend sind nur die Zeitstempel „Erzeugt“ in `baseline-raumgroessen.{json,md}`, `gegenfaelle.md`, `p50-skaliert.md` (nicht inhaltlich)
- Testfehler Lauf 1: nicht reproduzierter Einzelfehler (dynamischer Import in `gegenfaelle.test.ts`, Meldung nicht gesichert); drei Wiederholungen des Gesamtlaufs je 12/12 grün, `gegenfaelle` einzeln 9/9
- Versuchscode 2A (mit Florian abgestimmt, Commit 4a): `referat/2a/{regelkern-raumgroessen,gegenfaelle,p50-skaliert}.test.ts` schreiben nur noch mit `REFERAT_WRITE_EVIDENCE=1` nach `referat/evidenz/2a/`, sonst nur prüfen; „Aufruf“-Zeile im erzeugten Markdown nennt die Variable. Ergebnisse unverändert
  - Prüfung: `npx vitest run --config referat/2a/vitest.config.ts regelkern-raumgroessen gegenfaelle p50-skaliert` ohne Variable → 3 Dateien / 12 Tests grün, `referat/evidenz/2a/` unverändert (sha256 aller Dateien vorher = nachher)
- Evidenzstand für Commit 4a: `baseline-raumgroessen.json` `90e2d152…`, `.md` `32611f88…`; `gegenfaelle.json` `cf119de3…`, `.md` `d0c59697…`; `p50-skaliert.json` `a5c312ad…`, `.md` `1c1dba2d…` (erzeugt 2026-11-20 14:14 durch Prüflauf, HEAD `905250f2`)

## Commits der Gruppe (2026-11-20)

- Log-Dateien mit Doppelpunkt umbenannt (Doppelpunkt → Bindestrich), weil Gruppenmitglieder ggf. unter Windows klonen: `referat/evidenz/labor/build:libs.log` → `build-libs.log`, `prisma:generate.log` → `prisma-generate.log`, `prisma:migrate.log` → `prisma-migrate.log`, `prisma:migrate-2.log` → `prisma-migrate-2.log`, `prisma:migrate-3.log` → `prisma-migrate-3.log`. Inhalt unverändert. Pfadverweise in diesem Protokoll angepasst (Schritt 2.1, Zeile 6 und Nachtrag Zeile 11); Befehlsnamen wie `npm run prisma:migrate` bleiben
- Commit-Regeln in `CLAUDE.md` angepasst und committet (`028cff50`, Autor Antonius Richter)
- Pre-commit-Hook (lint-staged: `eslint --fix`, `prettier --write`, related tests) manuell nachgebildet, nur prüfend:
  - `prettier --check` schlägt fehl (nur Stil): 4a 21 von 26 prüfbaren Dateien, 4b 2 von 3, 4c 4 von 7
  - ESLint über `referat/2a/**/*.ts`: 0 Fehler, 5 Warnungen (`no-console` in `bench/aufwand.bench.ts`, `fallback/fallback-lauf.ts`); 2B/2C ohne TS/JS-Dateien
  - Formatierung bewusst ausgelassen, damit Evidenzdateien und protokollierte Prüfsummen unverändert bleiben; Commits mit `--no-verify`
- Commits (einzeln per Pfad gestagt, `git diff --cached --name-only` vor jedem Commit geprüft, keine Co-Authored-By-Zeile, nicht gepusht):
  - 4a 2A, Autor Florian Meyer: `referat/2a/`, `referat/evidenz/2a/`, `referat/evidenz/rubrik.md`
  - 4b 2B, Autor Jeremy Richter: `referat/2b/`, `referat/evidenz/2b/`
  - 4c Gemeinsames + 2C bis 5.1, Autor Antonius Richter: `referat/evidenz/{protokoll.md,manifest.md,labor/,seed/,2c/}`, `referat/2c/`

---

## Phase 5 / Schritt 5.2 – 2C Baseline full-context (2026-11-20)

- HEAD `ef5c3011` (Produktcode = `efd71b44`); Runtime unverändert aus 5.1 (Image `cb50fb7f…`, ctx 8192, parallel 1, n-predict 768, 4 Threads, 5 GiB / 4 CPU), läuft seit 12:22 ohne Neustart; Hardware: Manifest
- Aufzeichnender Proxy `node referat/2c/llm-proxy.mjs --listen 8081 --target 8080 --log referat/evidenz/2c/llm-exchanges.jsonl` (nur 127.0.0.1; Grund: Produkt-Client verwirft `timings`; Authorization-Header wird nicht protokolliert)
- Backend `referat/2c/start-backend.sh referat/evidenz/2c/backend-5.2.log`: `OPEN_WEIGHT_LLM_ENABLED=true OPEN_WEIGHT_LLM_URL=http://127.0.0.1:8081 OPEN_WEIGHT_LLM_SOCKET_PATH= OPEN_WEIGHT_LLM_TOKEN=<Compose-Default, nicht protokolliert>` Timeouts 30000/90000/300000, `QA_SUMMARY_ENABLED=true QA_SUMMARY_INFERENCE_URL= QA_SUMMARY_TIMEOUT_MS=90000 QA_SUMMARY_QUEUE_LIMIT=8 QA_SUMMARY_CONCURRENCY=1 QA_SUMMARY_COOLDOWN_MS=5000 QA_SUMMARY_TTL_MS=1800000 QA_NLP_ENABLED=false NLP_ENABLED=false WORD_CLOUD_SEMANTIC_ENABLED=false`. Cooldown auf das dokumentierte Minimum 5 s, damit Läufe 2–5 keine Cache-Treffer der Queue sind (Wartezeit 6 s)
- Fälle (je frischer Seed wegen Host-Token-TTL 15 min, `referat/2c/fall.sh baseline <a|b|c|d> 5`):
  - a `a-P200`: `seed-sechs-fragen.ts --p 200`; b `b-P200-lernziel`: `--p 200 --lernziel`; c `c-P50skaliert-lernziel`: `--p 50 --skaliert --lernziel`; keine unskalierte P50-Fixture
  - d `d-456-teilmenge`: `npx tsx referat/2c/seed-issue456-teilmenge.ts --teilnehmende 30` → 300 Fragen (50 eindeutige Texte) aus `buildIssue456ParticipantQuestions`, 4 268 deterministische Stimmen (mulberry32 0x456), alle ACTIVE, kein Lernziel (Lasttest-Lernziel ist quiz-weit, Session hier Q&A-only). Lasttest selbst nicht genutzt (verlangt ≥ 250 TN + Demo-Quiz)
- Lauf-Skript `referat/2c/baseline-lauf.mjs` (je Lauf `qa.summaryContextPreview`, `qa.requestSummary`, Polling `qa.summaryRuntime` alle 2 s); Sampler wie 5.1 je Fall
- Zeiten: a 15:26–15:37 (inkl. Fehlersuche Sampler), b 15:37:37–15:41:42, c 15:41:42–15:47:02, d 15:47:02–15:51:13
- **Ergebnisse** (Rohdaten `referat/evidenz/2c/baseline/`, Auswertung `npx tsx referat/2c/auswertung.ts`):
  - Alle 20 Läufe: `ready`, aber `effectiveMode: extractive`, `fallbackReason: invalid_response`. Modellausgabe in 20/20 schema-gültig (`QaSummaryModelOutputV2Schema`), aber 0/20 durch `hasAcceptableQaSummaryQuality`: Englisch trotz `locale de`, jede Aussage beginnt wörtlich mit „Specific topic:“ (gleiche Leads), teils technische Werte („Controversy score of 0.8“)
  - Gepackter Kontext: a/b E, F, C; c C, E, F (`selectionLimits.questions = 3`, Kürzung als `questions:3:deduplication` ausgewiesen) → A, B, D fehlen auch im full-context-Pfad. d: 300 total, 200 analyzed, 15 dedupliziert, 8 represented, Kürzungen `deduplication 185` + `token-budget 7`, Kompass im Pack entfernt (`compassSignals: 0`)
  - Tokens: Prompt 2005–2207, Completion 390–572, `finish_reason stop`; Prefill kalt 23,5–27,4 s, warm 81–90 ms (Prompt-Cache, `cache_n` = Prompt − 1); Generierung 10,9–11,3 Tokens/s; Gesamt Median 36–50 s
  - Kalt- vs. Warm-Ausgabe verschieden, warme Läufe untereinander identisch
- **Speicher:** `RssAnon` wächst mit jedem neuen Prompt (a 3,35 → d 5,07 GiB), `RssFile` 2,1–2,3 GiB; ab Fall c Swap (bis 2,2 GiB `memory.swap.current`), `memory.events max` 16 649, `oom_kill` 0, `OOMKilled=false`. Ursache: llama.cpp b10524 Prompt-Cache im Host-RAM, `--cache-ram` Default 8192 MiB (`llama-server --help`), im `entrypoint.sh` nicht gesetzt → Cache > Containerlimit. Nicht umgangen, Runtime nicht neu gestartet

## Phase 5 / Schritt 5.3 – 2C Ablationen (2026-11-20) – ANGEHALTEN nach OOM

- HEAD `ef5c3011`; Runtime, Proxy, Flags wie 5.2 (Harness mit denselben LLM-Flags: `referat/2c/start-harness.sh`); Backend lief parallel ohne Last
- Harness `referat/2c/ablation-harness.ts` (Kopf: Versuchscode, kein Produktpfad): je Fall einmal `buildModerationPromptContext`, Reduktion vor dem Packen, dann Produktweg `packSummaryModerationPromptContext` → `assemblePreparedModerationSummaryContext` → `runOpenWeightLlmSummaryV2` (temperature 0, max_tokens wie Produkt) → `bindQaSummaryModelOutputV2`, zusätzlich `hasAcceptableQaSummaryQuality`
  - `nur-texte`: Themen/Kompass/Lernziele `unavailable/outside-scope`, deren Quellen entfernt; Stimmen, Teilnehmerbasis, Beantwortungsstatus `unavailable/outside-scope`; `status` bleibt (Pflichtfeld, überall ACTIVE)
  - `texte-metadaten`: wie oben, aber Stimmen, Status, Teilnehmerbasis bleiben
  - reduzierter Kontext jeweils gegen `ModerationAnalysisContextV1Schema` geprüft
- Lauf `referat/2c/ablation-alle.sh a b c d` (je Fall frischer Seed, Varianten nacheinander, je 5 Läufe, Lauf 1 kalt), 15:52:21–16:12:16
- Gepackte Fragen (Trimmen auf 3 bzw. 8 betrifft alle Varianten; ohne Kompass schützt nichts mehr E/F):
  - a P200: voll E F C · nur-texte B F E · texte-metadaten B D C
  - b P200+LZ: voll E F C · nur-texte A E C · texte-metadaten C D B
  - c P50s+LZ: voll C E F · nur-texte E B C · texte-metadaten C A D
  - d #456: je 8 Fragen, je Variante andere Auswahl (Kürzung 185–186 deduplication + 6–7 token-budget)
- Gate (`hasAcceptableQaSummaryQuality`) ok: a nur-texte 5/5 (alle `uncertain`, 0 Aussagen), a texte-metadaten 5/5 (`ready`), b nur-texte 5/5 (`ready`), sonst 0/5. Prompt 1 290–1 490 Tokens (d ≈ 2 200), Prefill kalt 10–13 s (d 24 s), warm 74–83 ms, 12,4–12,8 Tokens/s
- **OOM:** Swap stieg weiter (Ende Fall d ≈ 4,84 GiB + 5 GiB RAM ≈ Memory+Swap-Limit 10 GiB). `docker events`: 16:12:13 `oom`, `die exitCode=137`, `start` (Restart-Policy `unless-stopped`), 16:12:28 `healthy`. Proxy: Lauf 2 von d/texte-metadaten (16:12:12) `socket hang up`, Läufe 3/4 `ECONNREFUSED` → `unavailable`, Lauf 5 `circuit_open` (Circuit-Breaker im Produkt-Client). 4 von 40 Ablationsläufen ungültig. `OOMKilled` steht nach dem Neustart wieder auf false; cgroup-Zähler des neuen Containers bei 0 (alte Werte nur bis 16:11:30 im Sampler)
- Runtime läuft nach automatischem Neustart (Cache leer). Nicht umgangen, nichts wiederholt; wartet auf Entscheidung

## Phase 5 / Schritt 5.3 (Fortsetzung) – Wiederholung d/texte-metadaten nach OOM-Neustart (2026-11-20)

- Entscheidung des Auftraggebers: Option A. Die OOM-Läufe bleiben in den Daten (markiert `oom_betroffen`); die Variante wird mit 5 neuen Läufen wiederholt.
- Commit `ef5c3011` (Produktcode 1.3.0 `efd71b44`), Runtime unverändert (ctx 8192, 4 CPU, 5 GiB, `--cache-ram` nicht gesetzt), Flags wie 5.3 (`referat/2c/start-harness.sh`).
- Aufruf: `OUTDIR=referat/evidenz/2c/ablation-wiederholung-nach-oom referat/2c/fall.sh ablation d 5 --varianten texte-metadaten --marke nach-oom-neustart`. Harness und `fall.sh` dafür um `--varianten`/`--marke`/`OUTDIR` erweitert; Standardverhalten unverändert.
- 19:32:56–19:37:31 MEZ (275 s). Frischer Seed V3FS23 (30 TN, 300 Fragen, 4 268 Stimmen, Prüfung ok) → `seed/ablation-ablation-wiederholung-nach-oom-d-456-teilmenge.json`.
- Ergebnis: 5/5 `completed`, schema-gültig, Modellstatus `uncertain`, Gate 0/5 (Z. 68, kein Lead), 8 Fragen im Kontext. Swap 0, RssAnon max 3,69 GiB. Prefill kalt 32,1 s, 9,1 Tokens/s, also langsamer als vor dem OOM bei gleicher Konfiguration; Ursache nicht untersucht.
- `docker events` des OOM lassen sich nachträglich nicht mehr abfragen (der Puffer wurde vom Restart-Loop `arsnova-v3-app` überschrieben, `RestartCount` > 400, unabhängig vom Versuch). Ersatznachweis: `StartedAt`/`RestartCount` → `2c/ablation/oom-nachweis.json`.

## Phase 5 / Schritt 5.4 – 2C Auswertung (2026-11-20)

- `npx tsx referat/2c/auswertung.ts` → `2c/auswertung.csv` (65 Läufe), `2c/auswertung-tabelle.md`, `2c/quellentreue-bogen.csv` (271 Zeilen, eine Raterin bzw. ein Rater, Fehlerklassen leer). `python3 referat/2c/gate-gruende.py` → `2c/gate-gruende.txt`. Text: `2c/auswertung.md`.
- Auswertungsregeln:
  - Nur gültige Läufe (HTTP 200) gehen in Kennzahlen ein.
  - Swap wird je Lauf gemessen und nicht angenommen.
  - Prefill gilt als kalt, wenn `cache_n` < 50 % der Prompt-Tokens ist; Cache-Treffer stehen getrennt.
- Gate-Gründe (Gegenprobe 65/65 gleich mit Produkt-Gate):
  - Baseline a: Z. 80, doppelter Lead „Specific topic“, Englisch.
  - Baseline b, c, d sowie alle abgelehnten Ablationen: Z. 68, Aussage ohne Lead.
- **Korrekturen früherer Einträge:**
  - (5.2) „Englisch, Specific topic, technische Werte“ gilt nur für Fall a; b, c und d antworten deutsch bzw. gemischt.
  - (5.3) a/nur-texte hat 3 Aussagen (Modellstatus `uncertain`), nicht 0. Das Gate besteht, weil alle drei einen eigenen Lead haben.
  - (5.3) Unter Swap liefen alle Ablationen a–d sowie Baseline c (Läufe 2–5) und d, nicht erst c und d.
- Weitere Befunde:
  - In keinem Lauf hat die Bindung eine sourceId entfernt.
  - Die Budgetschätzung in d (7 204 Tokens) überschätzt den tatsächlichen Prompt (2 207 Tokens) um das 3,3-Fache und löst die Kürzung `token-budget` (7 Fragen) aus.
  - In a und c ist die angezeigte Kurzfassung identisch mit der 2A-Extraktion (Mengen F/E/C).
- Runtime, Backend (Port 3000) und Proxy (8081) laufen weiter. Nichts committet.

## Phase 5 / Nachtrag 5.4 (2026-11-21)

- **Container `arsnova-v3-app` gestoppt** (01:00 MEZ): `docker update --restart=no arsnova-v3-app`, danach `docker stop arsnova-v3-app`. Der Container wurde nicht gelöscht.
  - Zustand danach: `exited`, Restart-Policy `no`, `RestartCount` 766 (erstellt 2026-10-09).
  - Fehler je Start: `exec /app/scripts/docker-entrypoint.sh: no such file or directory`.
  - Er gehört nicht zum Versuchsaufbau; das Backend lief lokal auf Port 3000.
  - Laut `RestartCount` lief er während aller 2C-Messungen (5.1–5.4) im Restart-Loop und kann dabei CPU-Last erzeugt haben. Das ist eine mögliche Erklärung für den langsameren Wiederholungslauf d/texte-metadaten (Prefill kalt 32,1 s statt 24,3 s, 9,1 statt 11,2 Tokens/s), aber **nicht belegt**: Die CPU-Last des Containers wurde nicht gemessen.
- **Kompakter Quellentreue-Bogen:** `python3 referat/2c/bogen-kompakt.py` → `2c/quellentreue-bogen-kompakt.csv`.
  - 271 Zeilen der Langfassung ergeben 93 Zeilen: 40 Aussagen kommen einmal vor, 34 viermal, 19 fünfmal.
  - Zusammengefasst werden identische Aussagen bei gleichem Modus, Fall, Variante, Art, Text und gleichen sourceIds. Neue Spalten: `vorkommen` und `lauf_ids`. Die Fehlerklassen sind leer.
  - Die Langfassung ist unverändert (SHA-256 `86a3a913…` vorher und nachher gleich).

## Phase 4 / Schritt 4.2 – 2B Baseline und Variante (2026-11-21)

- Commit `2b1848a1` (Produktcode 1.3.0 `efd71b44`), WSL2/Node v24.18.0, in-process, keine Dienste.
- Aufrufe:
  - `npx tsx referat/2b/eval.ts` → `2b/eval/{ergebnis.json,vorhersagen.csv,uebersicht.md}`; Text in `2b/eval/ergebnis.md`.
  - `npm run eval:qa-nlp -w @arsnova/backend` → `2b/eval/eval-qa-nlp-repo-seed.json` (exit 0, stderr leer).
- Referenzmenge: `referat/2b/referenz.csv` mit 80 Fragen, Gold = `label_person1`. Nur eine labelnde Person, daher κ und Uneinigkeit nicht berechenbar (Abweichung vom Runbook-Text, als Grenze vermerkt).
- Variiert wurde nur `QA_NLP_MIN_CONFIDENCE` (0,45 / 0,55 / 0,65), als Argument an `classifyQaNlpCascade` übergeben. Ohne Env-Änderung und ohne Produktcode-Änderung.
- Kernzahlen @0,55:
  - Kaskade: Abdeckung 73,8 %, Accuracy (classified) 67,8 %, Macro-F1 streng 0,571, Bestes Label 0,598, ECE 0,258.
  - Keyword: 38,8 %, 51,6 %, 0,300, 0,351, ECE 0,215.
  - Repo-Seed: Kaskade 85 % Abdeckung und 87,1 % Accuracy (classified).
- Befunde:
  - Die Schwelle wirkt nicht monoton (Abdeckung 0,45 < 0,55).
  - Die zehn auffälligsten Kaskaden-Fehler sind Gatekeeper-Early-Exits mit Konfidenz ≥ 0,95.
  - Die Labelregel 2 (Prüfungsrelevanz → organization) widerspricht dem Repo-Seed (`qaNlpSeed.ts`, Z. 60/416 = content) und dem Keyword-Lexikon. Dazu gibt es eine Sensitivitätsanalyse ohne 10 Musterfälle, bei unveränderten Labels.
- 2B-Dateien nur geschrieben, nicht gestagt.

## Phase 4 / Schritt 4.3 – 2B Laufzeit und Burst (2026-11-21)

- Commit `2b1848a1`, Produktcode 1.3.0 `efd71b44`, WSL2, Node v24.18.0, Backend lokal (Port 3000), PostgreSQL und Redis in Docker, nur Loopback.
- Aufruf: `referat/2b/burst-alle.sh 3`, 01:09:34–01:11:42 MEZ.
  - Konfigurationen: aus (`QA_NLP_ENABLED=false`), `an-limit100`, `an-limit20`.
  - Fest gesetzt: `QA_NLP_TIMEOUT_MS=2000`, `QA_NLP_CONCURRENCY=1`, `QA_NLP_MIN_CONFIDENCE=0.55`; übrige KI-Pfade aus.
  - Je Konfiguration ein frisches Backend und 3 Bursts mit je 200 gleichzeitigen `qa.submit` (20 TN × 10).
- Auswertung: `npx tsx referat/2b/burst-auswertung.ts`. Rohdaten in `2b/last/`; die Backend-Logs enthalten keine Tokens, nur den dotenv-Hinweis `injected env (94)` ohne Werte.
- Ergebnis:
  - 1 800/1 800 Submits erfolgreich.
  - Submit-Latenz in den warmen Läufen (p50/p95): aus 427/459 ms, limit100 422/471 ms, limit20 414/462 ms; Kaltstart je ≈ 1 s.
  - Skips je Lauf: limit100 98/200, limit20 179/200, jeweils `FAILED` `stub:queue-limit`.
  - Logzählung stimmt mit den Metrik-Deltas überein.
  - Direkt nach der letzten Antwort sind noch 12–18 Fragen `PENDING`, damit ist belegt, dass submit nicht wartet.
  - Reine Klassifikation p50 0,03 ms; RSS 400–470 MiB.
- Hinweis: `unclassifiedRate` in `qa.nlpRuntime` schließt die Skips aus.
- 2B-Dateien nur geschrieben, nicht gestagt.

## Phase 4 / Schritt 4.4 – 2B Kontextschnittstelle (2026-11-21)

- Commit `2b1848a1`. Backend mit `referat/2b/start-backend.sh true 100 referat/evidenz/2b/kontext/backend-kontext.log`, 01:16 MEZ, danach gestoppt.
- `npx tsx referat/2b/kontext-pruefung.ts --log … --out referat/evidenz/2b/kontext/kontext-pruefung.json`, zweimal ausgeführt (JKC8AU ohne und BHSNWH mit Gegenprobe), beide Male bestanden:
  - DB, Backend-Metriken und Log unverändert; PENDING bleibt PENDING; kein Enqueue im Prozess.
  - 11/11 Kontextfelder gleich DB.
  - Gegenprobe: completed +1, Log +1.
  - Fixture-Eingriffe per Prisma nur an eigenen Seed-Zeilen (PENDING, FAILED, DISABLED).
- Produkttests (`apps/backend`): `vitest run` für moderationQaContext, moderationQaContext.service und qaNlpQueue, 34/34 bestanden → `2b/kontext/vitest-ausgabe.txt`. Der Test „maps … without starting a job“ prüft nur den state.
- Beleg mit Codestellen: `2b/kontext.md`. 2B-Dateien nur geschrieben, nicht gestagt.

## Phase 4 / Nachtrag 4.2 – 2B Begründungen, Sensitivität 2, Entscheidung (2026-11-21)

- Commit `2b1848a1` (Produktcode 1.3.0 `efd71b44`), WSL2/Node v24.18.0, in-process, keine Dienste.
- **Herkunft:** Fehlerbegründungen, Einordnung der 10 Sensitivitäts-IDs und Entscheidung als **KI-Entwurf (Claude)** erstellt (`2b-entwurf-fuer-jeremy.md`, außerhalb des Repos), **von Jeremy Richter geprüft und freigegeben**. Übernahme wörtlich, inkl. der Kennzeichnung „Vermutung“.
- **Labels:** keine Änderung in `referat/2b/referenz.csv`.
- `2b/eval/ergebnis.md`:
  - Spalte „Begründung“ der Tabelle „Die 10 auffälligsten Fehler kaskade@0.55“ gefüllt, drei Fehlermuster als Absatz darunter.
  - Abschnitt „Sensitivität“: Einordnung der 10 IDs (Termin R007/R037/R061/R071, Hilfsmittel R036, Prüfungsrelevanz R003/R004/R026/R057, Grenzfall R053) und Seed-Widersprüche ergänzt. `qaNlpSeed.ts` Z. 416 (`content`) und Z. 1049 (`organization`) am Code verifiziert.
- **Sensitivität 2:** `referat/2b/eval.ts` um eine feste ID-Liste erweitert (ohne R003, R004, R026, R053, R057; n = 75), `npx tsx referat/2b/eval.ts` neu ausgeführt (exit 0) → `ergebnis.json` → `sensitivitaetKonfliktfaelle`.
  - Gegenprobe: `vorhersagen.csv` und `uebersicht.md` bytegleich, `ergebnis.json` bis auf `erzeugt` und den neuen Block unverändert.
  - Kaskade @0,55: Abdeckung 73 %, Acc. classified 69 %, Macro-F1 streng 0,581. Keyword @0,55: 36 %, 59 %, 0,320.
- **Neu:** `2b/entscheidung.md` (Abschnitt 3 des Entwurfs: Entscheidung, Voraussetzungen, Betriebsfolge, Grenzen).
- Bei der Prüfung gefunden, im Text nicht geändert, weil wörtlich freigegeben: Der Seed hat 186 Einträge, FR und ES je 22 (Entwurf: „ca. 23 von 187“). „Konfidenzintervall erklären“ steht nicht wörtlich im Seed; nächstliegend ist Z. 423 („Koennen Sie den Begriff Konfidenzintervall noch einmal definieren?“, `content`).

## Phase 4 / Korrektur 4.2 – 2B Seed-Belege in den Begründungen (2026-11-21)

- Jeremy Richter hat den zwei Korrekturen aus dem Nachtrag 4.2 zugestimmt: Seed 22 von 186 und R024 mit Z. 423.
- **Neuer Befund bei der Prüfung:**
  - Gatekeeper (`qaNlpGatekeeper.ts:11`) und k-NN-Fallback (`qaNlpFallback.ts:52`) trainieren nur auf den Seed-Splits `train` bzw. `train` + `prototype`, das sind 71 von 186 Einträgen.
  - Die in den Begründungen zitierten Zeilen 416 (R059), 423 und 795 (R024) sowie 1156 und 1226 (R078) liegen im Split `eval`. Das Modell hat sie nie gesehen.
  - Die Prüfungsrelevanz-Konvention `content` ist trotzdem im Training belegt: Z. 32, 60, 88, 130.
  - FR/ES im Training: je 7 von 71.
- **Erweiterte Korrektur in `2b/eval/ergebnis.md`** (Variante „erweitert korrigieren“, entschieden in der Sitzung):
  - R059 stützt sich jetzt auf die Train-Belege.
  - R024 und R078 sind um „nur im Eval-Split, nicht trainiert“ ergänzt.
  - Fehlermuster 2 lautet jetzt „je 22 von 186; trainiert werden nur `train` und `prototype`, darin FR/ES je 7 von 71“.
  - Über der Tabelle steht ein Hinweis zur Trainingsbasis.
  - `entscheidung.md` ist unverändert, weil keine der Aussagen betroffen ist.
- **Status:** Diese erweiterte Korrektur ist ein KI-Entwurf (Claude) und **noch nicht von Jeremy Richter freigegeben**. Deshalb ist sie nur geschrieben und **nicht committet**.

## Phase 6 / Schritt 6.1 – Abbildungen (2026-11-21)

- Arbeitsstand `0ca910f1` (Produktcode 1.3.0 `efd71b44`), WSL2/Node v24.18.0, keine Dienste.
- Rendern: SVG-Baukasten `referat/abbildungen/svg.ts`, gerastert mit `sharp` 0.35.5 (bereits Repo-Abhängigkeit) auf 300 dpi, Schrift DejaVu Sans.
  - `matplotlib` ist nicht installiert. Es wurde nichts installiert.
  - Palette: Referenzpalette des Dataviz-Leitfadens (heller Modus), Slots 1–3 mit dem Validator geprüft (alle Paare bestanden). Aqua liegt unter 3:1 Kontrast, deshalb gibt es Direktlabels und Datentabellen in den `index.md`.
- Aufrufe, alle mit exit 0:
  - `npx tsx referat/2a/abbildungen.ts` → `abbildungen/2a/k-werte-raumgroessen.{png,svg}`, `index.md`
  - `npx tsx referat/2b/abbildungen.ts` → `abbildungen/2b/{abdeckung-precision-schwellen,reliability}.{png,svg}`, `index.md`
  - `npx tsx referat/2c/abbildungen.ts` → `abbildungen/2c/{qualitaet-ttft,fragen-im-kontext,gate-ergebnis,speicher-bis-oom}.{png,svg}`, `index.md`
- 2C enthält zusätzlich: Fragen A–F im Kontext je Fall/Variante (a–c; d hat keine Fixture-Fragen), Gate-Ergebnis je Fall/Variante mit Grund und den Speicherverlauf bis zum OOM (16:12:13 MEZ aus `oom-nachweis.json`).
- „Qualität“ in der 2C-Abbildung ist nur das automatische Gate. Die Quellentreue wird weiterhin manuell bewertet.
- Jede Abbildung wurde gerendert und auf Überlappungen geprüft. Labels sind korrigiert, bis keine Kollision mehr vorlag.
- Prüfungen und Korrekturen während der Erstellung:
  - T-Formel am Code geprüft: `max(1, ⌈0,1·P⌉)`, `qaControversy.ts:16`.
  - Limit 3 belegt in `moderationSummaryContext.ts:195–197` (nicht Z. 187).
  - Fall d: 8 von 300 Fragen gepackt.
  - Ein Fehler beim Einlesen der Gate-Gründe (die Wiederholung überschrieb den OOM-Eintrag) ist behoben.

## Phase 6 / Schritt 6.2 – KI-Offenlegung (2026-11-21)

- `referat/evidenz/ki-offenlegung.md` enthält eine Tabelle aller Claude-Code-Schritte nach Runbook, Protokoll und Git-Historie. Die Spalte „Von uns geprüft/korrigiert“ ist leer.
- Gesondert aufgeführt sind die KI-Entwürfe:
  - 2B-Begründungen, Einordnung der IDs und Entscheidung (von Jeremy Richter geprüft);
  - Beispielbewertungen der Rubrik (von Florian Meyer geprüft, laut Angabe der Gruppe; im Protokoll vorher nicht vermerkt).
- Modell der früheren Sitzungen nicht protokolliert, in der Datei als „bitte ergänzen“ markiert.

## Phase 4 / Freigabe Korrektur 4.2 – 2B (2026-11-21)

- **Fehler im KI-Entwurf (Claude):** Die Begründungen R059, R024 und R078 sowie Fehlermuster 2 haben nicht beachtet, dass Gatekeeper und Fallback nur auf den Seed-Splits `train` bzw. `train` + `prototype` trainieren (71 von 186 Einträgen). Zitiert wurden Eval-Einträge, die das Modell nie gesehen hat, als ob es sie kennen würde.
- **Gefunden** von Claude Code bei der Prüfung der Korrekturen (Abschnitt „Korrektur 4.2“). **Korrigiert** in `2b/eval/ergebnis.md`. **Von Jeremy Richter geprüft und freigegeben.**
- `2b/entscheidung.md` geprüft: Die betroffenen Aussagen (Seed-Zahlen, „Modell folgt dem Seed“) kommen dort nicht vor, daher keine Änderung. „87 % auf Seed“ bezieht sich auf den Eval-Lauf `eval:qa-nlp` und ist korrekt.
- `ki-offenlegung.md`: Status der Korrektur auf „freigegeben“ aktualisiert.
