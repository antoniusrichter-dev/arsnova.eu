# Auftrag 2C – Auswertung Schritt 5.4 (Moderationskurzfassung mit privater Runtime)

Stand 2026-11-20 · Branch `referat/thema2-gruppe8` · Produktcode 1.3.0 (`efd71b44`), Arbeitsstand `ef5c3011` + unversionierter Versuchscode unter `referat/2c/` ·
Runtime llama.cpp b10524, Qwen3-4B-Instruct-2507 Q4_K_M, ctx 8192, parallel 1, 4 Threads, 5 GiB RAM / 10 GiB RAM+Swap (unverändert) · Hardware und Flags: `protokoll.md` 5.1–5.3.

Rohdaten: `auswertung.csv` (ein Lauf je Zeile), `auswertung-tabelle.md`, `gate-gruende.txt`, `quellentreue-bogen.csv`, Läufe unter `baseline/`, `ablation/`, `ablation-wiederholung-nach-oom/`, Runtime-Austausch `llm-exchanges.jsonl`. Erzeugt mit `npx tsx referat/2c/auswertung.ts` und `python3 referat/2c/gate-gruende.py`.

## Lesehilfe

- **Gültig** = die Runtime hat geantwortet (HTTP 200 mit Inhalt). Ungültige Läufe gehen in keine Kennzahl ein.
- **Qualitätsdaten** (Schema, Gate, Quellenbindung, Fragen im Kontext) gelten für alle gültigen Läufe unabhängig vom Swap.
- **Zeitwerte**: „unter Swap gemessen“ = `memory.swap.current` > 0 im Laufzeitfenster (Messung, nicht Annahme). Diese Werte stehen getrennt von den swapfreien.
- **Prefill kalt** = kein Prompt-Cache-Treffer (`cache_n` < 50 % der Prompt-Tokens), also echtes Prefill. **Cache-Treffer** (Läufe 2–5 mit identischem Prompt, `cache_n` = Prompt − 1) verarbeiten nur noch das letzte Token. Das ist kein Prefill, deshalb steht es in einer eigenen Spalte. Der erste Lauf je Fall/Variante ist „kalt“.
- Fragen A–F siehe `referat/fixtures/README.md` (E/F = Anwesenheitspflicht, Stimmen 40/40 und 20/20, die Kontroverse; C/D = Klausurrelevanz Kapitel 4; A/B = Regression).

### Qualität (alle gültigen Läufe, unabhängig von Swap)

| Fall | Variante | Läufe | gültig | OOM-betroffen | Fragen im Kontext | Schema ok | Gate ok | Modellstatus uncertain | entfernte IDs | Prompt-Tok. | Compl.-Tok. |
| ---- | -------- | ----: | -----: | ------------: | ----------------- | --------: | ------: | ---------------------: | ------------: | ----------: | ----------: |
| a-P200 | voll | 5 | 5 | 0 | F E C | 5/5 | 0/5 | 0/5 | 0 | 2005 | 500 |
| a-P200 | nur-texte | 5 | 5 | 0 | B F E | 5/5 | 5/5 | 5/5 | 0 | 1310 | 358 |
| a-P200 | texte-metadaten | 5 | 5 | 0 | B D C | 5/5 | 5/5 | 0/5 | 0 | 1485 | 308 |
| b-P200-lernziel | voll | 5 | 5 | 0 | E F C | 5/5 | 0/5 | 5/5 | 0 | 2141 | 395 |
| b-P200-lernziel | nur-texte | 5 | 5 | 0 | A E C | 5/5 | 5/5 | 0/5 | 0 | 1292 | 300 |
| b-P200-lernziel | texte-metadaten | 5 | 5 | 0 | C D B | 5/5 | 0/5 | 1/5 | 0 | 1464 | 285 |
| c-P50skaliert-lernziel | voll | 5 | 5 | 0 | C E F | 5/5 | 0/5 | 5/5 | 0 | 2162 | 520 |
| c-P50skaliert-lernziel | nur-texte | 5 | 5 | 0 | E B C | 5/5 | 0/5 | 5/5 | 0 | 1305 | 347 |
| c-P50skaliert-lernziel | texte-metadaten | 5 | 5 | 0 | C A D | 5/5 | 0/5 | 0/5 | 0 | 1492 | 291 |
| d-456-teilmenge | voll | 5 | 5 | 0 | 8 Fragen | 5/5 | 0/5 | 5/5 | 0 | 2207 | 391 |
| d-456-teilmenge | nur-texte | 5 | 5 | 0 | 8 Fragen | 5/5 | 0/5 | 4/5 | 0 | 2190 | 455 |
| d-456-teilmenge | texte-metadaten | 5 | 1 | 4 | 8 Fragen | 1/1 | 0/1 | 1/1 | 0 | 2227 | 403 |
| d-456-teilmenge | texte-metadaten (Wdh. nach OOM-Neustart) | 5 | 5 | 0 | 8 Fragen | 5/5 | 0/5 | 5/5 | 0 | 2173 | 391 |

### Zeit und Speicher (getrennt nach Messbedingung)

| Fall | Variante | Messbedingung | n | Prefill kalt (ms, n) | Prompt-Cache-Treffer: Rest-Prefill (ms, n) | Tokens/s | Runtime-Antwort Median (s) | Gesamt Median (s) | Peak RssAnon (MiB) | Peak RssFile (MiB) | Swap max (MiB) |
| ---- | -------- | ------------- | -: | -------------------: | -----------------------------------------: | -------: | -------------------------: | ----------------: | -----------------: | -----------------: | -------------: |
| a-P200 | voll | swapfrei | 5 | 27391 (1) | 82 (4) | 11,2 | 44,6 | 46,3 | 4060 | 2363 | 0 |
| a-P200 | nur-texte | unter Swap gemessen | 5 | 12654 (1) | 77 (4) | 12,6 | 28,7 | 28,7 | 5038 | 2156 | 2720 |
| a-P200 | texte-metadaten | unter Swap gemessen | 5 | 10337 (1) | 75 (4) | 12,4 | 25,2 | 25,2 | 5050 | 2156 | 3202 |
| b-P200-lernziel | voll | swapfrei | 5 | 23540 (1) | 85 (4) | 11,2 | 35,8 | 36,3 | 4777 | 2363 | 0 |
| b-P200-lernziel | nur-texte | unter Swap gemessen | 5 | 11457 (1) | 77 (4) | 12,7 | 23,9 | 23,9 | 5065 | 2158 | 3649 |
| b-P200-lernziel | texte-metadaten | unter Swap gemessen | 5 | 10212 (1) | 76 (4) | 12,4 | 23,3 | 23,3 | 5051 | 2158 | 3660 |
| c-P50skaliert-lernziel | voll | swapfrei | 1 | 24012 (1) | – (0) | 10,9 | 76,2 | 76,5 | 4778 | 2363 | 0 |
| c-P50skaliert-lernziel | voll | unter Swap gemessen | 4 | – (0) | 85 (4) | 11,1 | 47,9 | 49,3 | 5072 | 2359 | 1496 |
| c-P50skaliert-lernziel | nur-texte | unter Swap gemessen | 5 | 10998 (1) | 75 (4) | 12,8 | 27,5 | 27,5 | 5062 | 2158 | 4080 |
| c-P50skaliert-lernziel | texte-metadaten | unter Swap gemessen | 5 | 10311 (1) | 74 (4) | 12,6 | 23,5 | 23,5 | 5058 | 2156 | 4592 |
| d-456-teilmenge | voll | unter Swap gemessen | 5 | 25017 (1) | 87 (4) | 11,1 | 36,9 | 38,3 | 5074 | 2163 | 2224 |
| d-456-teilmenge | nur-texte | unter Swap gemessen | 5 | 24128 (1) | 83 (4) | 11,2 | 40,9 | 40,9 | 5063 | 2155 | 4961 |
| d-456-teilmenge | texte-metadaten | unter Swap gemessen | 1 | 24347 (1) | – (0) | 11,2 | 60,3 | 60,3 | 5061 | 2155 | 4843 |
| d-456-teilmenge | texte-metadaten (Wdh. nach OOM-Neustart) | swapfrei | 5 | 32139 (1) | 103 (4) | 9,1 | 42,8 | 42,8 | 3783 | 2373 | 0 |

## Befund 1 – Baseline: 20/20 schema-gültig, 0/20 durch das Qualitätsgate

Die Modellausgabe war in allen 20 Baseline-Läufen schema-gültig (`QaSummaryModelOutputV2Schema`). Keine Quelle wurde beim Binden entfernt. Das Produkt-Qualitätsgate hat trotzdem alle 20 Läufe abgelehnt. Jeder Lauf endete deshalb als `ready`, aber mit `effectiveMode: extractive` und `fallback.reason: invalid_response`. Moderierende sehen in keinem Fall Text vom Modell.

**Codestellen (1.3.0):**

- Gate: `apps/backend/src/lib/qaSummaryQuality.ts:59` (`hasAcceptableQaSummaryQuality`).
- Aufruf im Produktpfad: `apps/backend/src/lib/qaSummaryRuntimeAdapter.ts:133`. Bei `false` folgt der extraktive Fallback mit `invalid_response` (`qaSummaryRuntimeAdapter.ts:147–150`).

**Gründe je Fall.** Die erste verletzte Bedingung wird von `referat/2c/gate-gruende.py` zeilengenau ermittelt. Die Gegenprobe gegen das Produkt-Gate ergibt in allen 65 Läufen dasselbe ok/abgelehnt.

| Fall | Ausgabe des Modells | abgelehnt an |
| ---- | ------------------- | ------------ |
| a P200 | Englisch trotz `locale: de`; alle 4 Aussagen beginnen wörtlich mit „Specific topic:“; 3 von 4 nennen technische Werte („Controversy score of 0.8 …“) | Z. 80: doppelter Lead („specific topic“ viermal) – 5/5 |
| b P200 + Lernziel | Deutsch, Modellstatus `uncertain`, ganze Sätze ohne „Thema: Aussage“-Form („Die Anwesenheit ist umstritten, …“) | Z. 68: Aussage ohne Lead (`statementParts` → null) – 5/5 |
| c P50-skaliert + Lernziel | Deutsch/Englisch gemischt, teils technischer Lead („Q&A-Controversy-Score ist hoch …“), übrige Aussagen ohne Lead | Z. 68 – 5/5 |
| d #456-Teilmenge | Deutsch, `uncertain`, Sätze ohne Lead | Z. 68 – 5/5 |

**Korrektur gegenüber dem Zwischenbericht zu 5.2.** Die Beschreibung „Englisch, ‚Specific topic:‘, technische Werte“ trifft nur auf Fall a zu. In b, c und d antwortet das Modell (überwiegend) auf Deutsch. Abgelehnt wird dort, weil die vom Gate verlangte Form „Lead: Aussage“ fehlt.

Gemeinsam ist allen Fällen, dass das Gate inhaltlich brauchbare, quellengebundene Ausgaben an einer Formvorgabe scheitern lässt. Der Ausfall ist vollständig reproduzierbar: Bei `temperature: 0` sind die Läufe 2–5 je Fall textgleich.

## Befund 2 – Fragenauswahl: Die Kürzung greift auch im Full-Context-Pfad

`packSummaryModerationPromptContext` ruft zuerst `trimSummaryAnalysisQuestions` auf (`moderationSummaryContext.ts:789`, Funktion ab Z. 192). Bei weniger als 100 Fragen bleiben 3, ab 100 bleiben 16 (Z. 187/188). Geschützt sind nur Fragen aus Themen, Kompasssignalen und Lernziel-Scopes. Der Rest wird nach `questionBestScore` gereiht, bei Gleichstand nach `sourceId` (`forceFitQuestionCandidates`, Z. 486–510).

- **Baseline:** Im Kontext stehen immer E, F, C (in c nur andere Reihenfolge). A, B und D erreichen das Modell nie. Das Budget meldet diese Kürzung als `reason: deduplication` (3 Fragen), obwohl A/B und C/D nur Paraphrasen sind und keine Duplikate.
- **Ablationen:** Andere Fragen je Variante, weil ohne Kompasssignale E und F ihren Schutz verlieren.
  - a: nur-texte B F E, texte-metadaten B D C
  - b: A E C bzw. C D B
  - c: E B C bzw. C A D
  - Unter **texte-metadaten** fällt in a, b und c die Kontroverse E/F ganz oder teilweise heraus, obwohl sie die meisten Stimmen hat.
  - Unter **nur-texte** gibt es keine Stimmen. Alle Scores sind gleich, die Auswahl folgt also der zufälligen UUID-Reihenfolge der Seeds und nicht dem Inhalt. Darum unterscheiden sich a, b und c bei identischen Fragetexten.
- **Fall d** (300 Fragen, 50 eindeutige Texte):
  - 200 analysiert, 15 nach Deduplikation, 8 im Kontext.
  - Kürzungen: 185 `deduplication`, 7 `token-budget`; Kompass entfällt.
  - Die Budgetschätzung (`utf8-byte-upper-bound`) erwartet 7 204 Eingabe-Tokens, tatsächlich sind es 2 207 Prompt-Tokens. Die Kürzung um 7 Fragen wegen „token-budget“ beruht also auf einer etwa 3,3-fachen Überschätzung.
  - Je Variante steht eine andere Menge von 8 Fragen im Kontext.

## Befund 3 – Ablationen: Weniger Kontext besteht das Gate öfter

Das Gate bestehen nur a/nur-texte (5/5; Modellstatus `uncertain`, aber 3 Aussagen mit Lead), a/texte-metadaten (5/5 `ready`) und b/nur-texte (5/5 `ready`). Alle anderen Ablationen scheitern an Z. 68 (kein Lead).

Die Aussagen, die das Gate bestehen, sind meist wörtlich wiedergegebene Fragen mit vorangestelltem Thema („Klausurrelevanz: Ist Kapitel 4 klausurrelevant?“). Bei a/texte-metadaten fehlt darin die Anwesenheitskontroverse, weil E/F nicht im Kontext waren. Ob das inhaltlich trägt, klärt erst der Quellentreue-Bogen (Fehlerklasse `anliegen_fehlt`). Ergebnis: Befund 6 – bei a fehlt das Anliegen in allen durchgelassenen Ausgaben.

Quellenbindung: In keinem gültigen Lauf hat `bindQaSummaryModelOutputV2` eine sourceId entfernt. Das Modell zitiert nur erlaubte Quellen.

## Befund 4 – Prompt-Cache-Wachstum bis zum OOM (Runtime-Konfiguration 1.3)

- **Ursache:**
  - `docker/open-weight-llm/entrypoint.sh` (Z. 34–53) setzt `--cache-ram` nicht. Der llama.cpp-Default von b10524 ist 8192 MiB (`llama-server --help`) und liegt über dem Containerlimit von 5 GiB.
  - Jeder neue Prompt bleibt im Host-RAM-Prompt-Cache. `RssAnon` des `llama-server` wächst über die Läufe, und der Kernel lagert in den Swap aus, bis Memory + Swap (10 GiB) voll sind.
- **Verlauf** (Sampler `*-mem.csv`, 1 s; Maxima je Fall, RssAnon/RssFile aus `/proc/<llama-server>/status`, Swap = cgroup `memory.swap.current`):

| Abschnitt | RssAnon max | RssFile (mmap-GGUF) | Swap max |
| --------- | ----------: | ------------------: | -------: |
| 5.1 Probe | 3,19 GiB | 2,31 GiB | 0 |
| 5.2 a → b | 3,96 → 4,67 GiB | 2,31 GiB | 0 |
| 5.2 c (ab Lauf 2) → d | 4,95 → 4,96 GiB (Limit) | 2,31 → 2,11 GiB | 1,46 → 2,17 GiB |
| 5.3 a → b → c | 4,93–4,95 GiB (Limit) | 2,11 GiB | 3,13 → 3,57 → 4,48 GiB |
| 5.3 d bis OOM | 4,94 GiB | 2,10 GiB | 4,84 GiB |
| Wdh. d nach Neustart | 3,69 GiB | 2,32 GiB | 0 |

- **Zeitstempel (MEZ):**
  - d/texte-metadaten Lauf 2 startet um 16:12:12.
  - `docker events` um 16:12:13: `oom`, `die exitCode=137`, `start` (Restart-Policy `unless-stopped`); 16:12:28 `healthy`.
  - Der Lauf endet im Proxy mit `socket hang up`. Läufe 3 und 4: `ECONNREFUSED` → `unavailable`. Lauf 5: `circuit_open` (Circuit-Breaker im Produkt-Client).
  - Nachweis: Container-`StartedAt` 2026-11-20T15:12:13.594Z, `RestartCount` 1 (`ablation/oom-nachweis.json`).
  - Die Ereignisse wurden live abgelesen und im Protokoll 5.3 notiert. Der Ereignispuffer des Docker-Daemons enthält sie inzwischen nicht mehr: Er wurde vom unabhängig laufenden Restart-Loop des Containers `arsnova-v3-app` überschrieben (> 400 Restarts; nicht Teil des Versuchs, das Backend läuft lokal auf Port 3000).
- **Folgen:**
  - 4 von 40 Ablationsläufen sind ungültig und in den Daten als `oom_betroffen` markiert. Die Variante wurde mit 5 neuen Läufen auf frischem Seed wiederholt (Lauf 1 kalt, `marke: nach-oom-neustart`).
  - Im Produkt hätte der Circuit-Breaker nach dem Neustart weitere Anfragen kurzzeitig blockiert, und Moderierende bekommen die extraktive Kurzfassung.
- **Nicht geändert:** `--cache-ram`, Speicherlimit und alle übrigen Runtime-Parameter. Die Baseline bleibt 1.3.

## Befund 5 – Zeit

- **Swapfrei:**
  - Baseline a, b und c Lauf 1, außerdem die Wiederholung von d.
  - Echtes Prefill (kalt) bei 2 000–2 200 Prompt-Tokens: 23,5–27,4 s.
  - Generierung: 10,9–11,2 Tokens/s.
  - Eine Kurzfassung dauert 36–46 s (Median, P200), kalt bis 76 s (c).
- **Unter Swap gemessen** (alle Ablationen in a–d sowie Baseline c Läufe 2–5 und Baseline d):
  - Die Messung zeigt, dass der Swap schon ab Baseline c auftritt und alle Ablationen betrifft, nicht erst c und d.
  - Kürzere Prompts (1 290–1 490 Tokens): Prefill kalt 10,2–12,7 s, 12,4–12,8 Tokens/s.
  - Fall d (≈ 2 200 Tokens): 24,1–24,3 s, 11,1–11,2 Tokens/s.
  - Ein Einbruch der Generierungsrate durch Swap ist nicht erkennbar: Die Modellgewichte liegen als Datei-Mapping im Page Cache und nicht im Swap. Die Werte bleiben trotzdem getrennt ausgewiesen.
- **Cache-Treffer** (Läufe 2–5): Rest-Prefill 74–103 ms, also nur ein Token, kein echtes Prefill.
- **Einschränkung (Nachtrag 2026-11-22):** Die „kalten“ Ablationsläufe übernehmen 215–630 Tokens aus dem Prompt-Cache und sind nicht rein kalt; siehe Nachtrag unten.
- **Auffälligkeit:** Die swapfreie Wiederholung von d ist langsamer als die Läufe vor dem OOM (Prefill kalt 32,1 s statt 24,3 s, 9,1 statt 11,2 Tokens/s). Bei gleicher Runtime-Konfiguration wurde die Ursache nicht untersucht; Möglich ist Host-Last zum Wiederholungszeitpunkt (19:33 MEZ), etwa durch den Restart-Loop von `arsnova-v3-app`. Der Container lief während aller 2C-Messungen im Loop und wurde am 2026-11-21 gestoppt; seine CPU-Last wurde nicht gemessen, die Erklärung ist also nicht belegt.

### Nachtrag 2026-11-22 – „kalte“ Ablationsläufe nutzen den Prompt-Cache teilweise

- Die Regel „kalt = `cache_n` < 50 % der Prompt-Tokens“ (Lesehilfe) stuft auch Läufe als kalt ein, die einen Teil des Prompts aus dem Cache übernehmen. Der gemeinsame Präfix (technischer Prompt, Definitionen, Kontextkopf) ist bereits im Cache.
- In den kalten Ablationsläufen sind das 215–630 Tokens, bei „Texte + Metadaten“ 624–630 von 1 464–1 485 Tokens (≈ 42 %). Diese Läufe sind daher **nicht rein kalt**. Ihre Prefill-Zeiten (10,2–12,7 s) sind nicht direkt mit der Baseline (23,5–27,4 s, `cache_n` 3–189) vergleichbar. Der Zeitvorteil der Ablationen beruht nur zum Teil auf dem kürzeren Prompt.
- **Korrigierte Prefill-Schätzung:** Rechenweg `prefill_ms / prompt_n` (`prompt_n` = tatsächlich neu verarbeitete Tokens, also ohne `cache_n`), umgerechnet auf 100 Tokens. In den 12 kalten Läufen vor dem OOM ergibt das 1,15–1,37 s, also **≈ 1,2–1,4 s je 100 neu verarbeitete Prompt-Tokens**. Die Messbedingung (swapfrei bzw. unter Swap) ändert daran nichts erkennbar. Ausreißer ist die Wiederholung nach dem OOM mit 1,48 s (siehe Befund 5, Auffälligkeit).
- Quelle: `auswertung.csv`, Zeilen mit `prefill_art = kalt`, Felder `prompt_tokens`, `cache_n`, `prompt_n`, `prefill_ms`, `unter_swap`.

| Fall | Variante | Prompt-Tokens | davon aus Cache (`cache_n`) | neu verarbeitet (`prompt_n`) | Prefill (ms) | s je 100 neu verarbeitete Tokens | Messbedingung |
| ---- | -------- | ----: | ----: | ----: | ----: | ----: | ---- |
| baseline a-P200 | voll | 2005 | 3 | 2002 | 27391 | 1,37 | swapfrei |
| baseline b-P200-lernziel | voll | 2141 | 189 | 1952 | 23540 | 1,21 | swapfrei |
| baseline c-P50skaliert-lernziel | voll | 2162 | 189 | 1973 | 24012 | 1,22 | swapfrei |
| baseline d-456-teilmenge | voll | 2207 | 178 | 2029 | 25017 | 1,23 | unter Swap |
| ablation a-P200 | nur-texte | 1310 | 215 | 1095 | 12654 | 1,16 | unter Swap |
| ablation a-P200 | texte-metadaten | 1485 | 629 | 856 | 10337 | 1,21 | unter Swap |
| ablation b-P200-lernziel | nur-texte | 1292 | 304 | 988 | 11457 | 1,16 | unter Swap |
| ablation b-P200-lernziel | texte-metadaten | 1464 | 624 | 840 | 10212 | 1,22 | unter Swap |
| ablation c-P50skaliert-lernziel | nur-texte | 1305 | 345 | 960 | 10998 | 1,15 | unter Swap |
| ablation c-P50skaliert-lernziel | texte-metadaten | 1492 | 630 | 862 | 10311 | 1,20 | unter Swap |
| ablation d-456-teilmenge | nur-texte | 2190 | 215 | 1975 | 24128 | 1,22 | unter Swap |
| ablation d-456-teilmenge | texte-metadaten | 2227 | 265 | 1962 | 24347 | 1,24 | unter Swap |
| ablation-wiederholung-nach-oom d-456-teilmenge | texte-metadaten, Wdh. nach OOM | 2173 | 0 | 2173 | 32139 | 1,48 | swapfrei |

## Vergleich mit der 2A-Extraktion (`referat/evidenz/2a/fallback/`)

2A lief ohne Inferenz (`fallbackReason: disabled`, `extractive-v2`). In 2C fällt das Produkt wegen des Gates auf dieselbe Extraktion zurück (`invalid_response`).

| Fall | 2A-Extraktion | 2C Baseline – was Moderierende sehen | 2C Modell-Rohausgabe (nicht angezeigt) | 2C Ablation mit Gate ok |
| ---- | ------------- | ------------------------------------ | -------------------------------------- | ----------------------- |
| a P200 | F, E, C (`P200-haupt.json`, wörtliche Fragetexte) | F, E, C – identisch mit 2A (Text und Reihenfolge) | 4 englische Aussagen zu E/F (Kontroverse) und C, Quellen korrekt | texte-metadaten: B, D, C (ohne Kontroverse); nur-texte: B, F, E (ohne C) |
| b P200 + Lernziel | – (kein 2A-Lauf) | E, F, C – dieselbe Menge wie a, das Lernziel ändert die Auswahl nicht | Deutsch, `uncertain`, Anwesenheit umstritten, Kapitel 4 | nur-texte: A, E, C |
| c P50-skaliert + Lernziel | F, E, C (`P50-skaliert-haupt.json`) | C, E, F – dieselbe Menge wie 2A, andere Reihenfolge | gemischt, technischer Lead „Q&A-Controversy-Score“ | keine |
| d #456-Teilmenge | – (kein 2A-Lauf) | 4 wörtliche Fragen aus 8 gepackten (von 300) | Deutsch, `uncertain`, 4 Sätze | keine |

Ergebnis des Vergleichs: Mit der privaten Runtime zeigt 1.3.0 in den Fällen a und c **dieselbe Kurzfassung wie ganz ohne Modell (2A)**. Die Runtime kostet je Anfrage 36–76 s CPU-Zeit und Speicher bis an das Containerlimit, ohne dass sich die Anzeige ändert.

## Quellentreue-Bogen

`quellentreue-bogen.csv` ist für **eine** Raterin oder einen Rater vorbereitet:

- 271 Zeilen, je Aussage bzw. nächstem Schritt aus allen schema-gültigen Rohausgaben (Baseline und Ablationen, inklusive der Wiederholung).
- Spalten: `modus`, `fall`, `variante`, `lauf`, `art`, `nr`, `gate_ok` (true = im Produkt angezeigt), `aussagetext`, `sourceIds` (A–F bzw. sourceId).
- Leere Fehlerklassen: `erfunden`, `kennzahl_verwechselt`, `anliegen_fehlt`, `lernstandsbehauptung`, `pending_als_lernstand`, `bemerkung`.
- Da die Läufe 2–5 je Fall/Variante bei `temperature: 0` meist textgleich sind, genügt es, Lauf 1 voll zu bewerten und für die übrigen Läufe die Abweichungen zu markieren.
- Kompaktfassung `quellentreue-bogen-kompakt.csv` (`referat/2c/bogen-kompakt.py`): 93 Zeilen. Identische Aussagen sind zusammengefasst, mit den Spalten `vorkommen` und `lauf_ids`.
- **Bewertung (Nachtrag 2026-11-22):** Die Kompaktfassung ist ausgefüllt. **KI-Entwurf (Claude), von Antonius Richter geprüft.** Die Langfassung `quellentreue-bogen.csv` bleibt unbewertet; die Kompaktfassung deckt über `vorkommen`/`lauf_ids` alle 271 Zeilen ab.
- `anliegen_fehlt` ist je Ausgabe bewertet (eingetragen bei `statement` Nr. 1, sonst leer), alle anderen Fehlerklassen je Zeile.

## Befund 6 – Quellentreue (manuelle Bewertung)

Auswertung: `quellentreue-auswertung.md` (alle Tabellen, Prüfung des Bogens, Zählweise), erzeugt mit `npx tsx referat/2c/quellentreue.ts`. Abbildung: `../abbildungen/2c/quellentreue-fehler.png`. Gezählt wird gewichtet mit `vorkommen`; ein Eintrag ist eine Aussage oder ein nächster Schritt. „≥ 1 Fehler“ = `erfunden`, `kennzahl_verwechselt`, `lernstandsbehauptung` oder `pending_als_lernstand`.

| Menge | Ausgaben | Einträge mit ≥ 1 Fehler | Aussagen mit Fehler | nächste Schritte mit Fehler | erfunden | Kennzahl verwechselt | Anliegen fehlt (ja / nein / n/a) |
| ----- | -------: | ----------------------: | ------------------: | --------------------------: | -------: | -------------------: | -------------------------------- |
| alle | 61 | 89/271 (33 %) | 84/210 (40 %) | 5/61 (8 %) | 78 | 16 | 35 / 10 / 16 |
| Gate bestanden (Modelltext angezeigt) | 15 | 5/60 (8 %) | 0/45 | 5/15 | 5 | 0 | 10 / 5 / 0 |
| Gate abgelehnt (Extraktion angezeigt) | 46 | 84/211 (40 %) | 84/165 (51 %) | 0/46 | 73 | 16 | 25 / 5 / 16 |

- **Fehlerart:** Fast alle Fehler sind erfundene Details (78 Einträge), dazu 16 verwechselte Kennzahlen, davon 9 in c/voll. `lernstandsbehauptung` und `pending_als_lernstand` kommen nicht vor (0/271).
- **Je Fall und Variante** (Anteil Einträge mit ≥ 1 Fehler): a 40 / 25 / 0 %, b 33 / 0 / 75 %, c 52 / 40 / 45 %, d 4 / 76 / 40 % (n = 1 Ausgabe) / 0 % (Wdh.) – jeweils voll / nur Texte / Texte + Metadaten. Weniger Kontext senkt die Fehlerquote nicht systematisch.
- **Gate und Quellentreue:** Die 15 Ausgaben, die das Gate durchlässt (a nur Texte, a Texte + Metadaten, b nur Texte), enthalten keine fehlerhafte Aussage. Bei a nur Texte sind aber alle 5 nächsten Schritte erfunden, und bei a fehlt in allen 10 durchgelassenen Ausgaben ein Anliegen: bei nur Texte die Klausurfrage C/D, bei Texte + Metadaten die Anwesenheitskontroverse E/F (laut `bemerkung`). Das bestätigt Befund 3: Das Gate prüft die Form; ob die Kurzfassung das Anliegen trifft, prüft es nicht.
- **Anliegen fehlt** in 35 von 45 bewertbaren Ausgaben (Fälle a–c). Nur b/nur Texte und c/nur Texte treffen es (je 5/5); Fall d ist n/a.
- **Grenze:** eine bewertende Person (KI-Entwurf, geprüft von Antonius Richter), keine Zweitbewertung, daher keine Übereinstimmungsmaße. Die Läufe je Gruppe sind bei `temperature: 0` weitgehend textgleich; die gewichteten Zahlen sind daher keine 5 unabhängigen Stichproben.
