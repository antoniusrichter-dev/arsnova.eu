# 2A · Fall „P50-skaliert“

- Erzeugt: 2026-11-20T13:14:54.764Z
- Aufruf: `npx vitest run --config referat/2a/vitest.config.ts p50-skaliert`
- Grund: Die Fixture ist bei P = 50 nicht realisierbar (A hat 110 Stimmen > 50 Teilnehmende, Eigenbewertung gesperrt → erst ab P ≥ 111 konsistent).
- Regel (aus `referat/fixtures/seed-sechs-fragen.ts`, `planStimmen`): f = ⌊10 · (P − 1) / maxStimmen⌋ / 10 = ⌊10 · 49 / 110⌋ / 10 = **0,4**, Stimmen × f, kaufmännisch gerundet.
- Derselbe Fall wird in 3.3 per Seed in die Datenbank geschrieben (`--p 50 --skaliert`).
- P = 50, T = 5, Regelversion `moderation-compass-rules-v1`

| Frage | Fixture U/D | skaliert U/D | U+D | K skaliert | Badge skaliert | K rechnerisch (3.1) | Badge rechnerisch (3.1) |
| ----- | ----------: | -----------: | --: | ---------: | -------------- | ------------------: | ----------------------- |
| A | 80/30 | 32/12 | 44 | 0,4898 | onesided | 0,5217 | controversial |
| B | 10/0 | 4/0 | 4 | 0,0000 | insufficient | 0,0000 | onesided |
| C | 30/0 | 12/0 | 12 | 0,0000 | onesided | 0,0000 | onesided |
| D | 12/0 | 5/0 ¹ | 5 | 0,0000 | onesided | 0,0000 | onesided |
| E | 40/40 | 16/16 | 32 | 0,8649 | controversial | 0,9412 | controversial |
| F | 20/20 | 8/8 | 16 | 0,7619 | controversial | 0,8889 | controversial |

¹ gerundet (12 × 0,4 = 4,8 → 5).

- Karten skaliert: friction/caution [E, F]
- Nächster Schritt skaliert: controversy
- Karten rechnerisch (3.1): friction/caution [E, F, A]

## Unterschied zur rechnerischen Zeile P = 50

- A: controversial → onesided (K 0,5217 → 0,4898)
- B: onesided → insufficient (K 0,0000 → 0,0000)

Einordnung: Beim Verkleinern bleibt T = 5 gleich, während U + D schrumpft. Damit fällt K = 2·min(U,D)/(U+D+T) für jede Frage mit Gegenstimmen. P50-skaliert ist deshalb nicht mit der rechnerischen Zeile P = 50 aus 3.1 vergleichbar, sondern ein eigener Fall.
