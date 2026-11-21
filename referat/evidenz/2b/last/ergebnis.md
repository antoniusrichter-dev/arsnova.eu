# Auftrag 2B – Schritt 4.3: Laufzeit und Burst (Klassifikation 8.9b)

Stand 2026-11-21, 01:09–01:12 MEZ · Commit `2b1848a1` (Produktcode 1.3.0 `efd71b44`) · WSL2, Node v24.18.0 · lokales Backend (`npx tsx src/index.ts`, Port 3000), PostgreSQL und Redis in Docker · nur Loopback.

**Flags** (`referat/2b/start-backend.sh`):

- Variiert: `QA_NLP_ENABLED` und `QA_NLP_QUEUE_LIMIT`.
- Explizit auf Produkt-Defaults gesetzt: `QA_NLP_TIMEOUT_MS=2000`, `QA_NLP_CONCURRENCY=1`, `QA_NLP_MIN_CONFIDENCE=0.55`.
- Alle anderen KI-Pfade aus (LLM, Summary, spaCy, Encoder).

**Ablauf** (`referat/2b/burst-alle.sh` → `referat/2b/burst.ts`):

- Je Konfiguration wird das Backend frisch gestartet, die Zähler stehen also bei 0.
- Danach 3 Läufe. Jeder Lauf nutzt eine neue Q&A-Session mit 20 Teilnehmenden und schickt 200 `qa.submit` gleichzeitig ab (10 je TN, Texte zyklisch aus `referenz.csv`).
- Gemessen werden:
  - die Client-Latenz je Submit;
  - `qa.nlpRuntime.metrics` vor dem Burst, direkt nach der letzten Antwort und bis zum Leerlauf;
  - `nlpStatus` in der DB;
  - die RSS des Backend-Prozesses im 100-ms-Takt.
- Auswertung: `npx tsx referat/2b/burst-auswertung.ts` → `zusammenfassung.{json,md}`.

## Ergebnisse

| Konfiguration | Lauf | Submits ok | p50 (ms) | p95 (ms) | max (ms) | Burst (ms) | DB direkt nach letzter Antwort | DB am Ende | Δ completed / skipped / failed | RSS vorher → max (MiB) |
| ------------- | ---: | ---------: | -------: | -------: | -------: | ---------: | ------------------------------ | ---------- | ------------------------------ | ---------------------: |
| aus | 1 (kalt) | 200/200 | 1235 | 1272 | 1280 | 1291 | DISABLED 200 | DISABLED 200 | 0 / 0 / 0 | 397 → 427 |
| aus | 2 | 200/200 | 471 | 508 | 511 | 512 | DISABLED 200 | DISABLED 200 | 0 / 0 / 0 | 430 → 446 |
| aus | 3 | 200/200 | 427 | 459 | 462 | 464 | DISABLED 200 | DISABLED 200 | 0 / 0 / 0 | 446 → 449 |
| an-limit100 | 1 (kalt) | 200/200 | 977 | 1051 | 1052 | 1057 | PENDING 18, CLASSIFIED 60, UNCERTAIN 24, FAILED 98 | CLASSIFIED 73, UNCERTAIN 29, FAILED 98 | 102 / 98 / 0 | 416 → 429 |
| an-limit100 | 2 | 200/200 | 510 | 561 | 564 | 566 | PENDING 16, CLASSIFIED 62, UNCERTAIN 24, FAILED 98 | CLASSIFIED 73, UNCERTAIN 29, FAILED 98 | 102 / 98 / 0 | 432 → 437 |
| an-limit100 | 3 | 200/200 | 422 | 471 | 475 | 476 | PENDING 12, CLASSIFIED 69, UNCERTAIN 21, FAILED 98 | CLASSIFIED 78, UNCERTAIN 24, FAILED 98 | 102 / 98 / 0 | 440 → 445 |
| an-limit20 | 1 (kalt) | 200/200 | 966 | 1032 | 1036 | 1037 | CLASSIFIED 16, UNCERTAIN 5, FAILED 179 | CLASSIFIED 16, UNCERTAIN 5, FAILED 179 | 21 / 179 / 0 | 440 → 455 |
| an-limit20 | 2 | 200/200 | 491 | 545 | 549 | 550 | CLASSIFIED 17, UNCERTAIN 4, FAILED 179 | CLASSIFIED 17, UNCERTAIN 4, FAILED 179 | 21 / 179 / 0 | 459 → 464 |
| an-limit20 | 3 | 200/200 | 414 | 462 | 467 | 467 | CLASSIFIED 13, UNCERTAIN 8, FAILED 179 | CLASSIFIED 13, UNCERTAIN 8, FAILED 179 | 21 / 179 / 0 | 468 → 473 |

| Konfiguration | Log qa_nlp:completed | Log qa_nlp:skipped (Grund) | Log qa_nlp:failed | latencyMs completed p50 / p95 / max | Submit p50 / p95 Läufe 2–3 (Median, ms) |
| ------------- | -------------------: | -------------------------- | ----------------: | ----------------------------------- | --------------------------------------- |
| aus | 0 | 0 | 0 | – | 427 / 459 |
| an-limit100 | 306 | 294 (queue-limit) | 0 | 2 / 4 / 477 | 422 / 471 |
| an-limit20 | 63 | 537 (queue-limit) | 0 | 2 / 162 / 655 | 414 / 462 |

Reine Klassifikation (classifyQaNlpCascade, in-process, ohne DB/Last): 80 Fragen × 20 = 1600 Messungen, p50 0,030 ms, p95 1,443 ms, max 3,623 ms.

Die Zählung in den Logs stimmt mit den Metrik-Deltas überein: limit100 3 × 102 completed + 3 × 98 skipped, limit20 3 × 21 + 3 × 179.

## Nachweis: `qa.submit` wartet nicht auf die Klassifikation

1. **Codepfad:**
   - `qa.submit` (`apps/backend/src/routers/qa.ts:1995`) legt die Frage zuerst per `arsnova_create_qa_question` mit `nlpStatus` `PENDING` an.
   - Danach ruft es `enqueueQaNlpJob` **ohne `await`** auf (`qa.ts:2043`).
   - `enqueueQaNlpJob` (`apps/backend/src/lib/qaNlpQueue.ts:273`) ist synchron. Es legt den Job in die Queue und startet die Verarbeitung über `setImmediate` (`pump`, `schedule`). Es gibt nur `queued`, `skipped` oder `disabled` zurück, nie ein Klassifikationsergebnis.
2. **Messung (limit100):** Direkt nach der *letzten* Submit-Antwort sind noch 12–18 Fragen `PENDING`, und erst 81–87 von 102 Jobs sind abgeschlossen. Mehrere Antworten sind also zurückgekommen, bevor ihre Frage klassifiziert war.
3. **Latenz:** Mit Klassifikation ist die Submit-Latenz praktisch gleich wie ohne. Läufe 2–3, Median der p50/p95-Werte: aus 427/459 ms, limit100 422/471 ms, limit20 414/462 ms. Lauf 1 ist je Konfiguration ein Kaltstart mit rund 1 s.

## Beobachtungen (Interpretation ist Eigenleistung)

- **Auch beim Default-Limit fällt die Hälfte aus.**
  - Bei einem gleichzeitigen Burst von 200 Fragen werden mit dem Default `QA_NLP_QUEUE_LIMIT=100` je Lauf 98 Fragen übersprungen (49 %), mit Limit 20 sind es 179 (90 %).
  - Übersprungene Fragen erhalten dauerhaft `FAILED` mit `nlpModelVersion` `stub:queue-limit` (`qaNlpQueue.ts:284`). Im Versuch wurde keine nachklassifiziert; am Ende des Laufs steht kein Eintrag mehr auf `PENDING`.
- **Die Rechenzeit der Klassifikation ist nicht der Engpass.**
  - Rein in-process kostet eine Klassifikation 0,03 ms (p50), p95 1,4 ms, max 3,6 ms.
  - Die `latencyMs` aus `qa_nlp:completed` (Verarbeitung plus DB-Schreiben, ohne Wartezeit in der Queue) liegt bei p50 2 ms. Unter dem Burst steigt sie bis 477 ms (limit100) bzw. 655 ms (limit20).
  - Die Queue füllt sich, weil mit `QA_NLP_CONCURRENCY=1` nur ein Job gleichzeitig läuft und jeder auf seinen DB-Write wartet, während die 200 Submits innerhalb von ~0,5 s ankommen. Das ist eine Ableitung aus Code und Messwerten; die Ursache wurde nicht isoliert gemessen.
- **Die Laufzeitmetrik verdeckt die Skips.**
  - `unclassifiedRate` in `qa.nlpRuntime` beträgt am Ende 0,27, gerechnet als `unclassified/(completed+failed)` (`qaNlpQueue.ts`, `getQaNlpMetrics`).
  - Die übersprungenen Fragen gehen nicht ein. Bezogen auf alle 600 Submits waren bei limit100 nur 51 % (306 von 600) klassifiziert oder uncertain, bei limit20 10,5 % (63 von 600).
- **RSS:** 400–470 MiB. Sie wächst über die Läufe leicht, und zwar in allen Konfigurationen (aus 397 → 449, limit20 440 → 473). Ein Mehrbedarf durch die Klassifikation ist darin nicht erkennbar.
