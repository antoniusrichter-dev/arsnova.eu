# 2A · Aufwand Regelkern und extraktiver Fallback (Schritt 3.4)

- Erzeugt: 2026-11-17T13:49:05.090Z
- HEAD Arbeitsbranch: `52b352826a810676dcb1e0110e130bea8f7f27c9` (Produktcode = Referenz-Commit `efd71b44`)
- Laufzeit: Node v24.18.0 (V8 13.6.233.17-node.50), `--expose-gc`, Single-Thread
- Hardware: AMD Ryzen 9 7950X3D 16-Core Processor, 32 logische CPUs, WSL2 – Details in `referat/evidenz/manifest.md`
- Aufruf: `node --expose-gc --import tsx referat/2a/bench/aufwand.bench.ts`
- Methode: je Szenario und N 5 Warm-up-Läufe, dann 30 Wiederholungen; vor jeder Wiederholung `gc()`; Dauer per `process.hrtime.bigint()`; Heap-Delta = `heapUsed` nach minus vor dem Aufruf (ohne GC dazwischen, also allokierter und noch nicht freigegebener Speicher). p95 nach Nearest-Rank.
- Eingabe: deterministisch erzeugte Fragen (mulberry32, Seed 0x2a2a2a2a + N), ca. 20 % PENDING, 10 % PINNED, 70 % ACTIVE, 0–120 Stimmen. Kartenbildung mit P = 200 (T = 20).
- Kartenbildung misst nur die Regelfunktionen; Scores entstehen im Releasepfad in SQL und sind hier vorberechnet.
- Fallback misst `createExtractiveQaSummaryOutput` inkl. Zod-Validierung. N = 500 und 2500 sind ein Belastungsfall oberhalb dessen, was der Releasepfad an die Kurzfassung übergibt.
- **Korrektur der Einordnung (2026-11-20, nach Schritt 3.3):** `selectionLimits.questions = 40` ist die Grenze des Moderationskontexts, nicht der Kurzfassung. Im Summary-Pfad kürzt `trimSummaryAnalysisQuestions` (`apps/backend/src/lib/moderationSummaryContext.ts:192–197`) danach auf **3 Fragen** bei weniger als 100 Fragen bzw. **16 Fragen** ab 100 Fragen (`QA_SUMMARY_LARGE_CORPUS_THRESHOLD`, `QA_SUMMARY_MAX_QUESTION_CANDIDATES`, Zeilen 187–188). Im Releasepfad erreichen den extraktiven Fallback also höchstens 16 Fragen; der Fallback selbst gibt höchstens 4 Aussagen aus. Damit liegen bereits alle drei gemessenen N (50/500/2500) über der Produktgrenze. Die Messwerte bleiben unverändert gültig, sie sind als obere Abschätzung zu lesen. Beleg: `referat/evidenz/2a/fallback/ergebnis.md`.
- Rohdaten: `aufwand-roh.csv` (eine Zeile je Wiederholung), Zusammenfassung: `aufwand.csv`

| Szenario | N | Median [µs] | p95 [µs] | Min–Max [µs] | Heap-Delta Median [KiB] | Heap-Delta p95 [KiB] | Ergebnis |
| -------- | -: | ----------: | -------: | -----------: | ----------------------: | -------------------: | -------- |
| kartenbildung | 50 | 42,1 | 99,0 | 23,7–131,5 | 11,7 | 20,7 | friction:8 clarification:8; next=pending-qa |
| extraktiv | 50 | 113,5 | 210,2 | 79,9–222,9 | 42,3 | 48,5 | status=ready; statements=4 |
| kartenbildung | 500 | 85,0 | 134,5 | 71,5–151,8 | 67,5 | 69,4 | friction:8 clarification:8; next=pending-qa |
| extraktiv | 500 | 185,1 | 263,2 | 149,9–285,0 | 93,9 | 100,0 | status=ready; statements=4 |
| kartenbildung | 2500 | 399,5 | 518,2 | 345,0–566,2 | 386,2 | 388,8 | friction:8 clarification:8; next=pending-qa |
| extraktiv | 2500 | 498,4 | 688,4 | 372,6–782,1 | 346,9 | 352,3 | status=ready; statements=4 |
