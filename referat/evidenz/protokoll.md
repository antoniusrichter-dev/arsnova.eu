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
