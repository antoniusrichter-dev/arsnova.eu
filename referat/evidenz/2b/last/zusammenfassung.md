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
