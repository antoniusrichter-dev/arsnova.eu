# Auftrag 2B – Schritt 4.4: Kontextschnittstelle #456

Stand 2026-11-21 · Commit `2b1848a1` (Produktcode 1.3.0 `efd71b44`) · Backend lokal mit `QA_NLP_ENABLED=true`, `QA_NLP_QUEUE_LIMIT=100` (`referat/2b/start-backend.sh`), nur Loopback.

**Behauptung:** In den #456-Moderationskontext gehen nur bereits persistierte Kategorien ein. Ein Kontextabruf (`qa.summaryContextPreview` bzw. `buildModerationPromptContext`) startet keine neue Klassifikation.

## 1. Codestellen

- **Klassifikation wird nur an zwei Stellen gestartet**, nämlich bei den Aufrufen von `enqueueQaNlpJob` außerhalb von Tests:
  - `apps/backend/src/routers/qa.ts:2043` in `qa.submit`, nach dem Anlegen der Frage;
  - `apps/backend/src/routers/qa.ts:1970` in `qa.redactPassages`, nach der Schwärzung, weil sich der Text geändert hat.
- **Wer die Klassifikationsmodule importiert:** `qaNlpQueue`, `qaNlpWorker` und `qaNlpCascade` werden außerhalb von Tests nur von `qaNlpQueue.ts`, `qaNlpWorker.ts`, `routers/qa.ts` und `routers/health.ts` importiert. `health.ts` liest dabei nur `getQaNlpMetrics`. Kein Modul des Kontextpfads importiert sie (`moderationQaContext.ts`, `moderationPromptContext.ts`, `moderationSummaryContext.ts`, `qaSummary*.ts`).
- **Der Kontext liest nur gespeicherte Spalten:**
  - `apps/backend/src/lib/moderationQaContext.ts` lädt `nlpStatus`, `nlpCategory`, `nlpConfidence`, `nlpModelVersion` und `nlpAnalyzedAt` per SQL (`loadQaCandidateRows`, Z. 351–355 und 395–399).
  - `projectStoredQaNlp` (Z. 250–302) projiziert diese Spalten nur. `PENDING` wird zu `pending`, `DISABLED` zu `disabled`, `FAILED` zu `failed`; unvollständige Daten werden `failed` und nicht ergänzt. Die Konfidenz trägt `meaning: 'uncalibrated-model-score'`.
  - Die Projektion wird in Z. 496 aufgerufen. Die Revision `qa-nlp:<sha256>` aus den gespeicherten Feldern entsteht in `buildNlpRevision` (Z. 304–317) und geht als `questionNlp` in die Revisionsprüfung ein (Z. 1090).

## 2. Laufzeitbeleg: `referat/2b/kontext-pruefung.ts` → `kontext-pruefung.json`

**Aufbau:**

1. Frische Session `BHSNWH` mit 8 Fragen per `qa.submit`. Das Backend klassifiziert sie echt.
2. Danach drei Fixture-Zustände per Prisma an den eigenen Seed-Zeilen: Frage 1 auf `PENDING` mit leeren Feldern (wie ein noch nicht gelaufener Job), Frage 2 auf `FAILED` `stub:queue-limit`, Frage 3 auf `DISABLED`.
3. Kontextabruf: 3 × `qa.summaryContextPreview` über HTTP im Backend-Prozess und 1 × `buildModerationPromptContext` im Prüfprozess, dort mit `QA_NLP_ENABLED=true`.
4. Vorher/Nachher-Vergleich nach 2 s Wartezeit.
5. Gegenprobe: ein weiterer echter `qa.submit` muss die Detektoren auslösen.

| Prüfung | Ergebnis |
| ------- | -------- |
| `dbUnveraendert` | ja |
| `pendingBleibtPending` | ja |
| `backendMetrikenUnveraendert` | ja |
| `backendLogOhneNeueQaNlpZeilen` | ja |
| `inProzessKeinEnqueue` | ja |
| `alleFragenImVollkontext` | ja |
| `kontextGleichDb` | ja |
| `gegenprobeDetektorenGreifen` | ja |
| `previewSnapshotStabil` | ja |

Gegenprobe: `completed` +1, Logzeilen +1. Ein Submit wird von den Detektoren also erkannt; die Kontextabrufe davor haben sie nicht ausgelöst.

**Feldvergleich Kontext ↔ DB:** Bei `classified` und `uncertain` werden Status, Kategorie, Konfidenz, Modellversion und Zeitstempel verglichen, sonst nur der Status.

| Quelle | Frage | DB `nlpStatus` | Kontext `nlp.state` | Kategorie | Konfidenz | Modellversion | gleich |
| ------ | ----- | -------------- | ------------------- | --------- | --------: | ------------- | ------ |
| analyse-voll | Können wir mehr Beispiele zur linearen Regression bearbeiten | PENDING | pending | – | – | – | ja |
| analyse-voll | Ist Kapitel 4 klausurrelevant? | FAILED | failed | – | – | – | ja |
| analyse-voll | Soll die Anwesenheit verpflichtend sein? | DISABLED | disabled | – | – | – | ja |
| analyse-voll | Mein Bildschirm bleibt schwarz, wenn ich den Link öffne | CLASSIFIED | classified | content | 0,6638 | gatekeeper-hash-nb-v1 | ja |
| analyse-voll | Warum folgt aus einem Zusammenhang nicht automatisch eine Ur | CLASSIFIED | classified | technical | 0,9975 | gatekeeper-hash-nb-v1 | ja |
| analyse-voll | Wann ist die Abgabefrist für das Projekt? | CLASSIFIED | classified | organization | 1,0000 | gatekeeper-hash-nb-v1 | ja |
| analyse-voll | The audio stream keeps cutting out, can you check the microp | CLASSIFIED | classified | technical | 0,9998 | gatekeeper-hash-nb-v1 | ja |
| analyse-voll | Kannst du die Herleitung der Varianz noch einmal erklären? | CLASSIFIED | classified | content | 1,0000 | gatekeeper-hash-nb-v1 | ja |
| preview-gepackt | Mein Bildschirm bleibt schwarz, wenn ich den Link öffne | CLASSIFIED | classified | content | 0,6638 | gatekeeper-hash-nb-v1 | ja |
| preview-gepackt | Kannst du die Herleitung der Varianz noch einmal erklären? | CLASSIFIED | classified | content | 1,0000 | gatekeeper-hash-nb-v1 | ja |
| preview-gepackt | Wann ist die Abgabefrist für das Projekt? | CLASSIFIED | classified | organization | 1,0000 | gatekeeper-hash-nb-v1 | ja |

**Hinweise:**
- In dieser Stichprobe kommt kein `UNCERTAIN` vor, alle 5 echt klassifizierten Fragen sind `CLASSIFIED`. Die Abbildung von `uncertain` belegt der Produkttest unten.
- Das Preview enthält nach der Kürzung auf 3 Fragen (`trimSummaryAnalysisQuestions`, < 100 Fragen) nur klassifizierte Fragen. Die PENDING/FAILED/DISABLED-Fälle sind daher nur im vollen Analysekontext geprüft.
- Ein erster, identischer Lauf ohne Gegenprobe (Session JKC8AU) war ebenfalls in allen Punkten bestanden. Die JSON-Datei enthält den zweiten Lauf.

## 3. Testausgabe des Produkts: `vitest-ausgabe.txt`

`npx vitest run src/lib/moderationQaContext.test.ts src/lib/moderationQaContext.service.test.ts src/lib/qaNlpQueue.test.ts` (in `apps/backend`): 3 Dateien, **34/34 Tests bestanden**.

Relevante Tests:
- `moderationQaContext persisted NLP mapping › maps classified and uncertain results with explicit uncalibrated provenance`
- `… › maps PENDING|DISABLED|FAILED without starting a job`
- `… › degrades incomplete persisted classifier data instead of inventing provenance`
- `qaNlpQueue › ueberspringt bei vollem Queue-Limit und markiert failed`

**Einschränkung:** Der Produkttest „maps … without starting a job“ prüft nur den abgebildeten `state` (`moderationQaContext.test.ts:603–616`), nicht, dass kein Job startet. Diesen Teil der Behauptung belegt erst der Laufzeitbeleg in Abschnitt 2.
