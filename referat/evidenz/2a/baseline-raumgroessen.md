# 2A · Baseline Regelkern über Raumgrößen (Schritt 3.1)

- Erzeugt: 2026-11-20T13:14:53.521Z
- HEAD Arbeitsbranch: `905250f2889f908a29f18f0bc4eacd79beca452e` (Produktcode = Referenz-Commit `efd71b44`)
- Regelversion: `moderation-compass-rules-v1`
- Fixture: `referat/fixtures/sechs-fragen-szenario.json` (A–F, alle ACTIVE)
- Aufruf: `npx vitest run --config referat/2a/vitest.config.ts regelkern-raumgroessen`
- Hardware: siehe `referat/evidenz/manifest.md`
- Echte Funktionen: `resolveQaControversyThreshold`, `isQaControversialLabel`, `isQaControversyInsufficientVotes`, `resolveQaControversyBadgeKind`, `selectPendingModerationQuestionSourceIds`, `selectFrictionQuestionSourceIds`, `planModerationCompass`. K und Best-Score nach `qaRankingSql.ts` nachgerechnet; Verdrahtung wie `buildCompassContext` (nur Q&A-Anteil, keine Themen/Quiz/Blitzlicht).

Badges: `controversial` = umstritten (K > 0,5 und U+D ≥ T), `insufficient` = zu wenige Stimmen (U+D < T), `onesided` = einseitig.

> **Hinweis zu P = 50:** Die Zeile P = 50 ist rechnerisch, aber nicht realisierbar. Frage A hat 80 + 30 = 110 Stimmen, in der Session gibt es aber nur 50 Teilnehmende, und jede Stimme stammt von einer eigenen Person (QaUpvote eindeutig je Person und Frage). Da Autor:innen ihre eigene Frage nicht bewerten dürfen (`apps/backend/src/routers/qa.ts:345`), ist die Fixture erst ab P ≥ 111 konsistent. Für P = 50 gibt es den realisierbaren Fall „P50-skaliert“ (Stimmen × 0,4) in `referat/evidenz/2a/p50-skaliert.md`.

## P = 50 · T = 5

| Frage | U/D | U+D | K (controversyScore) | Best-Score | Badge |
| ----- | --: | --: | -------------------: | ---------: | ----- |
| A | 80/30 | 110 | 0,5217 | 0,6374 | controversial |
| B | 10/0 | 10 | 0,0000 | 0,7225 | onesided |
| C | 30/0 | 30 | 0,0000 | 0,8865 | onesided |
| D | 12/0 | 12 | 0,0000 | 0,7575 | onesided |
| E | 40/40 | 80 | 0,9412 | 0,3930 | controversial |
| F | 20/20 | 40 | 0,8889 | 0,3520 | controversial |

- Karten: friction/caution [E, F, A]
- Nächster Schritt: controversy (Karte `friction`, attachToCard=false – tautologisch bei nur einer Karte, nicht angehängt)
- Quellen: E, F, A (`qa-question:55555555-5555-4555-8555-555555555555`, `qa-question:66666666-6666-4666-8666-666666666666`, `qa-question:11111111-1111-4111-8111-111111111111`)

## P = 200 · T = 20

| Frage | U/D | U+D | K (controversyScore) | Best-Score | Badge |
| ----- | --: | --: | -------------------: | ---------: | ----- |
| A | 80/30 | 110 | 0,4615 | 0,6374 | onesided |
| B | 10/0 | 10 | 0,0000 | 0,7225 | insufficient |
| C | 30/0 | 30 | 0,0000 | 0,8865 | onesided |
| D | 12/0 | 12 | 0,0000 | 0,7575 | insufficient |
| E | 40/40 | 80 | 0,8000 | 0,3930 | controversial |
| F | 20/20 | 40 | 0,6667 | 0,3520 | controversial |

- Karten: friction/caution [E, F]
- Nächster Schritt: controversy (Karte `friction`, attachToCard=false – tautologisch bei nur einer Karte, nicht angehängt)
- Quellen: E, F (`qa-question:55555555-5555-4555-8555-555555555555`, `qa-question:66666666-6666-4666-8666-666666666666`)

## P = 500 · T = 50

| Frage | U/D | U+D | K (controversyScore) | Best-Score | Badge |
| ----- | --: | --: | -------------------: | ---------: | ----- |
| A | 80/30 | 110 | 0,3750 | 0,6374 | onesided |
| B | 10/0 | 10 | 0,0000 | 0,7225 | insufficient |
| C | 30/0 | 30 | 0,0000 | 0,8865 | insufficient |
| D | 12/0 | 12 | 0,0000 | 0,7575 | insufficient |
| E | 40/40 | 80 | 0,6154 | 0,3930 | controversial |
| F | 20/20 | 40 | 0,4444 | 0,3520 | insufficient |

- Karten: friction/caution [E]
- Nächster Schritt: controversy (Karte `friction`, attachToCard=false – tautologisch bei nur einer Karte, nicht angehängt)
- Quellen: E (`qa-question:55555555-5555-4555-8555-555555555555`)

## P = 1000 · T = 100

| Frage | U/D | U+D | K (controversyScore) | Best-Score | Badge |
| ----- | --: | --: | -------------------: | ---------: | ----- |
| A | 80/30 | 110 | 0,2857 | 0,6374 | onesided |
| B | 10/0 | 10 | 0,0000 | 0,7225 | insufficient |
| C | 30/0 | 30 | 0,0000 | 0,8865 | insufficient |
| D | 12/0 | 12 | 0,0000 | 0,7575 | insufficient |
| E | 40/40 | 80 | 0,4444 | 0,3930 | insufficient |
| F | 20/20 | 40 | 0,2857 | 0,3520 | insufficient |

- Karten: — (keine Karte)
- Nächster Schritt: — (keine Empfehlung)
- Quellen: —

## Übersicht K je Raumgröße

| Frage | P=50 (T=5) | P=200 (T=20) | P=500 (T=50) | P=1000 (T=100) |
| ----- | --- | --- | --- | --- |
| A | 0,52 **umstritten** | 0,46 | 0,38 | 0,29 |
| B | 0,00 | 0,00 < T | 0,00 < T | 0,00 < T |
| C | 0,00 | 0,00 | 0,00 < T | 0,00 < T |
| D | 0,00 | 0,00 < T | 0,00 < T | 0,00 < T |
| E | 0,94 **umstritten** | 0,80 **umstritten** | 0,62 **umstritten** | 0,44 < T |
| F | 0,89 **umstritten** | 0,67 **umstritten** | 0,44 < T | 0,29 < T |

## Abgleich mit plaene-2a-2b-2c.md §0.2

Geprüft: T je P, K(A)/K(E)/K(F) auf zwei Nachkommastellen gerundet, Markierung „umstritten“ bzw. „< T Stimmen“, soweit die Plantabelle sie nennt.

| P | Feld | Plan | Ist | |
| -: | ---- | ---- | --- | - |
| 1000 | K(A) | 0,27 | 0,29 (exakt 0,285714) | ⚠️ **Abweichung** |
