# 2A · Schritt 3.3 – Extraktiver Fallback im Releasepfad

- Datum: 2026-11-20 · HEAD `905250f2` (Produktcode = `efd71b44`) · Hardware: siehe `referat/evidenz/manifest.md`
- Backend: `cd apps/backend && QA_SUMMARY_ENABLED=true OPEN_WEIGHT_LLM_ENABLED=false QA_SUMMARY_INFERENCE_URL= npx tsx src/index.ts`
  (für Störung a zusätzlich `QA_SUMMARY_QUEUE_LIMIT=1`), tRPC `http://127.0.0.1:3000/trpc`; sonst Defaults aus `.env` (nicht protokolliert)
- Skript: `referat/2a/fallback/fallback-lauf.ts` (echte tRPC-Aufrufe mit Host-Token aus `referat/.local/`; Token nicht protokolliert, jede Ausgabedatei vor dem Schreiben auf den Token geprüft)
- Sessions per Seed `referat/fixtures/seed-sechs-fragen.ts` (Rohdaten `referat/evidenz/seed/`)
- Flags wirksam: alle Antworten melden `enabled: true`, `inferenceConfigured: false`

## Hauptfall und Zusatzfälle (Ergebnis siehe auch Befund 1)

Aufrufe je Fall: `qa.summaryRuntime` → `qa.summaryContextPreview(de)` → `qa.requestSummary(de)` → `qa.summaryRuntime` (Polling bis nicht mehr `pending`).

| Fall | Session | Antwort requestSummary | Endstatus | effectiveMode | Fallback-Grund | modelVersion | Aussagen | Quellen (aufgelöst) | Zeit bis fertig |
| ---- | ------- | ---------------------- | --------- | ------------- | -------------- | ------------ | -------: | ------------------- | --------------: |
| **P200** (Haupt) | 6X3D44 | pending (36 ms) | ready | extractive | `disabled` | extractive-v2 | 3 | F, E, C (3/3) | 31 ms |
| P500 | XEA84G | pending (34 ms) | ready | extractive | `disabled` | extractive-v2 | 3 | D, E, C (3/3) | 148 ms |
| P50-skaliert (mit Lernziel) | 4HP8T2 | pending (36 ms) | ready | extractive | `disabled` | extractive-v2 | 3 | F, E, C (3/3) | 141 ms |

Ausgabe P200 (wörtlich): „Sollten wir eine Anwesenheitspflicht einführen?“ · „Soll die Anwesenheit verpflichtend sein?“ ·
„Ist Kapitel 4 klausurrelevant?“; Einschränkung: „Eine ausführliche Zusammenfassung war diesmal nicht möglich. Deshalb
werden die wichtigsten Fragen im Wortlaut angezeigt.“; keine nächsten Schritte.

Vollständige Antworten: `P200-haupt.json`, `P500-haupt.json`, `P50-skaliert-haupt.json` (jeweils `antwortSummaryContextPreview`,
`antwortRequestSummary`, `antwortSummaryRuntime`).

## Befund 1 (Hauptbefund) – Kurzfassung kürzt auf 3 von 6 Fragen, das fachliche Anliegen A/B fällt weg

Alle drei Fälle melden im Kontext `corpus: total 6, eligible 6, analyzed 6, represented 3` und `selectionLimits.questions = 3`.

**Codestelle** (Referenz-Commit `efd71b44`), `apps/backend/src/lib/moderationSummaryContext.ts`:

- Zeilen 187–188: `QA_SUMMARY_MAX_QUESTION_CANDIDATES = 16`, `QA_SUMMARY_LARGE_CORPUS_THRESHOLD = 100`
- Zeilen 192–197: `trimSummaryAnalysisQuestions(analysis, maxQuestions = total ≥ 100 ? 16 : 3)`, aufgerufen in Zeile 789 (`packSummaryModerationPromptContext`)
- Zeilen 203–234: geschützte Fragen = Themen-Repräsentanten, **bis zu 2 Fragen je Kompass-Signal**, Lernziel-Aufgaben (nur Scope `tasks`)
- Zeilen 236–251: zuerst geschützte Fragen übernehmen, dann bis `maxQuestions` nach `forceFitQuestionCandidates` (Zeile 486: Status-Lanes, darin absteigend nach Best-Score) auffüllen

**Best-Score (Wilson-Untergrenze) der Fixture**, nachgerechnet wie `qaRankingSql.ts`:

| Frage | U/D | Best-Score | U/D skaliert | Best-Score skaliert |
| ----- | --: | ---------: | -----------: | ------------------: |
| A | 80/30 | 0,637 | 32/12 | 0,582 |
| B | 10/0 | 0,722 | 4/0 | 0,510 |
| C | 30/0 | **0,886** | 12/0 | **0,757** |
| D | 12/0 | 0,757 | 5/0 | 0,566 |
| E | 40/40 | 0,393 | 16/16 | 0,336 |
| F | 20/20 | 0,352 | 8/8 | 0,280 |

**Welche Fragen fehlen je Fall:**

| Fall | Kompass-Signal (geschützt) | aufgefüllt nach Best-Score | im Kontext | **fehlen** |
| ---- | -------------------------- | -------------------------- | ---------- | ---------- |
| P200 | Reibung [E, F] | C (0,886) | F, E, C | **A, B, D** |
| P500 | Reibung [E] | C (0,886), D (0,757) | D, E, C | **A, B, F** |
| P50-skaliert | Reibung [E, F] | C (0,757) | F, E, C | **A, B, D** |

**Warum das fachliche Anliegen A/B wegfällt:**

1. Nur ein bzw. zwei freie Plätze: Die Reibungsfragen E/F belegen als geschützte Kompass-Belege 2 der 3 Plätze (bei P500 einen).
2. A ist nicht geschützt: Bei P200/P500 ist A nicht umstritten (K 0,46 bzw. 0,38 ≤ 0,5), bei P50-skaliert ebenfalls nicht (K 0,49). A steckt daher in keinem Kompass-Signal. Nur in der rechnerischen, nicht realisierbaren Zeile P = 50 (K 0,52) wäre A Teil der Reibungskarte.
3. Der Best-Score bestraft Gegenstimmen: A hat die meisten Stimmen (110) und den höchsten Saldo (+50), aber wegen der 30 Gegenstimmen nur 0,637. Die einseitigen Fragen C (0,886), D (0,757) und B (0,722) liegen davor. Der freie Platz geht an C (bei P500 an C und D).
4. B kommt nie zum Zug: B liegt mit 10 Stimmen hinter C und D, bei P50-skaliert sogar hinter A und D.
5. Keine Zusammenführung von Paaren: Der Trim arbeitet auf Einzelfragen. Ohne semantische Themen (`topics: disabled`, serverseitig aus) gibt es keinen Themen-Repräsentanten, der A/B schützen würde.

Folge: Die Kurzfassung zeigt nur Anwesenheitspflicht (E/F) und Prüfungsrelevanz (C bzw. C/D). Das meistunterstützte und fachlich wichtigste Anliegen
(Übungsbedarf Regression, A/B) ist in keinem Fall enthalten. Bei P50-skaliert ist zwar das bestätigte Lernziel zur Regression im Kontext
(`learningContext: available`), aber ohne passende Frage. Der extraktive Fallback gibt es außerdem nicht aus, weil er bei ≥ 2 Q&A-Quellen nur
Q&A-Fragen nimmt (`qaSummaryExtractive.ts`). Die Kompass-Signalquelle steht ebenfalls im Kontext, erscheint aber nicht als Aussage.

Bezug zur Rubrik: Das betrifft unmittelbar K3 (Trennung Orga/Fachlich, A/B fehlt) und K5 (Informationsumfang, ein Anliegen fehlt), und es ist
für K4 relevant, weil die Einschränkung nur pauschal („diesmal nicht möglich“) und ohne Hinweis auf die 3-Fragen-Grenze ausgegeben wird.

Abgrenzung: `selectionLimits.questions = 40` (Moderationskontext) ist nicht die Grenze der Kurzfassung. Die Einordnung in `../aufwand.md` ist entsprechend korrigiert.

## Störung a – Warteschlange voll (`QA_SUMMARY_QUEUE_LIMIT=1`)

Zwei Sessions (P200, P500), je eine `requestSummary` gleichzeitig (`Promise.all`). Erwartet: `queue_full`.

| Lauf | Datei | P200 | P500 |
| ---: | ----- | ---- | ---- |
| 1 | `stoerung-a-queue-full-lauf1.json` (Runde 1) | pending → ready/`disabled` | **ready/`queue_full`**, extractive, 3 Aussagen |
| 2 | `stoerung-a-queue-full-lauf2.json` | **ready/`queue_full`**, extractive, 3 Aussagen | pending → ready/`disabled` |
| 3 | `stoerung-a-queue-full-lauf3.json` | pending → ready/`disabled` | **ready/`queue_full`**, extractive, 3 Aussagen |

- In jedem Lauf wird genau eine Anfrage angenommen und die andere sofort extraktiv mit `queue_full` beantwortet. Welche Session gewinnt, hängt vom Timing ab.
- Backend-Log: `qa_summary:skipped { reason: 'queue-full' }` je Lauf (`backend-queue1.log`).
- Lauf 1 hatte 5 Runden. In den Runden 2–5 griff der Cooldown-Cache (30 s, gleicher Snapshot, Fallback `disabled` mit retry `not-applicable`), daher kein erneutes Queueing. Deshalb wurden Lauf 2 und 3 jeweils nach 35 s Pause mit einer Runde wiederholt.
- Eine einzelne Session kann `queue_full` nicht auslösen: eine zweite Anfrage derselben Session während `inflight` gibt nur den laufenden Zustand zurück (`qaSummaryQueue.ts`, `requestQaSummary`).

## Störung b – Frage löschen während pending

Eigene frische Session P200 (MNS434, `referat/evidenz/seed/stoerung-b-p200.json`), weil die Host-Token der ersten Sessions nach
15 min abgelaufen waren (`DEFAULT_HOST_SESSION_TTL_SECONDS`, Produktverhalten). Löschung über `qa.moderate` (`DELETE`).

| Versuch | Variante | Ergebnis |
| ------: | -------- | -------- |
| 1 | `parallel` (requestSummary und Löschung von F gleichzeitig) | `requestSummary` bricht ab mit „Der autorisierte Q&A-Kontext hat sich während des Aufbaus geändert.“ Die Löschung von F war erfolgreich. Keine Datei (Skript brach damals ab; Fehlertext aus der Konsole übernommen). |
| 2 | `nach-pending`, Frage F | pending erhalten, Löschung schlägt fehl („Frage nicht gefunden.“, F war seit Versuch 1 gelöscht) → `stoerung-b-source-changed-P200-nach-pending-F.json` |
| 3 | `nach-pending`, Frage E | Antwort direkt `ready` aus dem Cooldown-Cache, also kein Pending und keine Löschung (Datei durch Versuch 4 überschrieben) |
| 4 | `nach-pending`, Frage E, nach 32 s | **pending** (35 ms) → Löschung E `DELETED` (59 ms) → Endstatus **ready, extractive, `source_changed`** (retry `manual`), Quellen C, B, D (E nicht mehr enthalten) → `stoerung-b-source-changed-P200-nach-pending-E.json` |

Pfad im Produkt bei Versuch 4 laut Backend-Log (`backend-stoerung-b.log`): Der Job selbst endete mit
`qa_summary:failed { reason: 'context_unavailable' }` (dieselbe Konsistenzprüfung wie in Versuch 1). Den Status `source_changed`
setzte danach `qa.summaryRuntime` über `getQaSummaryRuntimeFresh` (Snapshot-Hash geändert → extraktiv neu gebunden).
Der Zwischenstand `failed` war beim ersten Polling schon ersetzt. Der Zweig `source_changed` innerhalb von `processJob`
(Änderung genau zwischen den beiden `prepare`-Aufrufen, `qaSummaryQueue.ts`, `sourceChanged ? bindExtractiveResult(…, 'source_changed', …)`)
wurde im Labor nicht getroffen. Ohne Inferenz liegen die beiden `prepare`-Aufrufe direkt hintereinander, und eine Änderung während
eines `prepare` endet in `context_unavailable`. Eine eigene Fault-Injection wurde bewusst nicht gebaut.

### Beleg aus vorhandenen Produkttests

Beide `source_changed`-Wege sind durch vorhandene Unit-Tests in `apps/backend/src/lib/qaSummaryQueue.test.ts` abgedeckt
(`prepare`/`processor` als Mocks über `resetQaSummaryQueueForTests`, keine Datenbank):

| Test (describe `qaSummaryQueue V2`) | Zeile | Codepfad | Prüft |
| ----------------------------------- | ----: | -------- | ----- |
| „verwirft generative Ausgabe wenn sich Quellen während der Inferenz ändern“ | 175 | **im Job** (`processJob`): `prepare` liefert vor dem Lauf Hash `a`, nach dem Lauf Hash `b` | Ergebnis hat Hash `b`, `effectiveMode: 'extractive'`, `fallback.reason: 'source_changed'`, generative Ausgabe verworfen |
| „revalidiert ein fertiges Ergebnis unmittelbar vor der Auslieferung“ | 231 | Auslieferung (`getQaSummaryRuntimeFresh`) | fertiges Ergebnis mit Hash `c`, danach Kontext `d` → `extractive`/`source_changed` mit Hash `d` |

Aufruf und Ausgabe (2026-11-20, `produkttest-source-changed.log`):

```
cd apps/backend && npx vitest run src/lib/qaSummaryQueue.test.ts \
  -t "verwirft generative Ausgabe wenn sich Quellen während der Inferenz ändern|revalidiert ein fertiges Ergebnis unmittelbar vor der Auslieferung" --reporter=verbose

 ✓ src/lib/qaSummaryQueue.test.ts > qaSummaryQueue V2 > verwirft generative Ausgabe wenn sich Quellen während der Inferenz ändern 79ms
 ✓ src/lib/qaSummaryQueue.test.ts > qaSummaryQueue V2 > revalidiert ein fertiges Ergebnis unmittelbar vor der Auslieferung 48ms
 Test Files  1 passed (1)
      Tests  2 passed | 10 skipped (12)
```

Einordnung: Der Zweig im Job ist damit nur auf Unit-Ebene mit Mocks belegt (Evidenzstufe „Produkttest“). Im Labor-Releasepfad ist er nicht
nachgewiesen. Dort ist der Frisch-Pfad belegt (Versuch 4), der im Labor auftretende Weg führt über `context_unavailable`.

## Prüfpunkt Runbook

| Prüfpunkt | Ergebnis |
| --------- | -------- |
| Ausgabe ist `extractive` | ✅ alle drei Fälle, `modelVersion extractive-v2`, Grund `disabled` |
| Quellen lösen auf | ✅ 3/3 je Fall gegen die geseedeten Fragen-IDs; nur 3 von 6 Fragen vertreten, A/B fehlen (Befund 1) |
| Störung a zeigt `queue_full` | ✅ 3/3 Läufe |
| Störung b zeigt `source_changed` | ✅ Endstatus `source_changed`; Abweichungen: paralleles Löschen führt zu einem Abbruch von `requestSummary`, und beim Löschen nach pending läuft der Weg über `context_unavailable` → Frisch-Pfad; Zweig im Job nur per Produkttest belegt |
