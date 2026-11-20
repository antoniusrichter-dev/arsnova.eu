# Fixture „Sechs-Fragen-Szenario“ (Runbook Schritt 2.2)

Gemeinsame Fixture für 2A/2B/2C (Issue #456 §12). Fragen A–F, alle `ACTIVE`:

| ID  | Frage                                                         |   U/D |
| --- | ------------------------------------------------------------- | ----: |
| A   | Können wir mehr Beispiele zur linearen Regression bearbeiten? | 80/30 |
| B   | Gibt es ein weiteres Beispiel zur linearen Regression?        |  10/0 |
| C   | Ist Kapitel 4 klausurrelevant?                                |  30/0 |
| D   | Müssen wir den vierten Abschnitt für die Prüfung lernen?      |  12/0 |
| E   | Soll die Anwesenheit verpflichtend sein?                      | 40/40 |
| F   | Sollten wir eine Anwesenheitspflicht einführen?               | 20/20 |

Optionales bestätigtes Lernziel: „Die Studierenden können lineare Regressionsmodelle anwenden.“

## Dateien

- `sechs-fragen-szenario.json`: reine Datenstruktur für Unit-Tests. Texte wörtlich aus
  `libs/shared-types/src/moderation-prompt-context-fixtures.ts`, mit festen `sourceId`s.
- `seed-sechs-fragen.ts`: Seed gegen die lokale Datenbank, parametrisierbar mit Raumgröße P und
  optionalem Lernziel.

## Seed

Voraussetzung: Postgres/Redis laufen (`docker compose up -d postgres redis`), Backend läuft
(`npm run dev:backend`). Nur Loopback-Ziele; andere Hosts lehnt das Skript ab.

```bash
npx tsx referat/fixtures/seed-sechs-fragen.ts --p 200
npx tsx referat/fixtures/seed-sechs-fragen.ts --p 500 --lernziel
npx tsx referat/fixtures/seed-sechs-fragen.ts --p 50 --skaliert --lernziel --out <pfad>.json
npx tsx referat/fixtures/seed-sechs-fragen.ts --p 1000 --dry-run
```

Ablauf:

1. Q&A-Session über die echte API (`session.create`, Vorab-Moderation aus).
2. Mit `--lernziel`: bestätigtes Lernziel über `session.saveLearningObjectives` (Scope `session`).
3. P Teilnehmende, sechs Fragen und echte `QaUpvote`-Zeilen per Prisma, wie die Produkt-Seeds
   `seed:qa-forum` und `seed:moderation-compass`. Die Zähler `positiveVoteCount`/`negativeVoteCount`
   setzt allein der DB-Trigger `QaUpvote_reconcile_counts`. Das Skript setzt keine Zähler und setzt
   keinen Trigger aus.
4. Rücklesen: Teilnehmende = P, 6 Fragen `ACTIVE`, Zähler = Sollwerte. Bei Abweichung Exit 1.

Neue sourceIds: Jede Session bekommt eigene Frage-IDs (`qa-question:<uuid>`). Die Zuordnung A–F steht
in der Ausgabe bzw. in der `--out`-Datei.

Host-Token: Er steht nur in `referat/.local/host-<CODE>.json` (Modus 0600). Das Verzeichnis
schließt sich per eigener `.gitignore` aus. Der Token erscheint weder auf stdout noch in der `--out`-Datei.

### Realisierbarkeit und Fall „P50-skaliert“

Jede Stimme stammt von einer eigenen teilnehmenden Person. Autor:innen dürfen ihre eigene Frage
nicht bewerten (`apps/backend/src/routers/qa.ts:345`). Pro Frage sind daher höchstens P − 1 Stimmen
möglich. A braucht 110 Stimmen, die Fixture ist also erst ab **P ≥ 111** realisierbar. P = 200, 500
und 1000 laufen unverändert.

Für kleinere P bricht der Seed ab, außer mit `--skaliert`. Dann gilt
f = ⌊10 · (P − 1) / 110⌋ / 10, und alle Stimmen werden mit f multipliziert und kaufmännisch gerundet.
Für P = 50 ist f = 0,4 (Fall „P50-skaliert“):

| ID  | Fixture |       P50-skaliert |
| --- | ------: | -----------------: |
| A   |   80/30 |              32/12 |
| B   |    10/0 |                4/0 |
| C   |    30/0 |               12/0 |
| D   |    12/0 | 5/0 (4,8 gerundet) |
| E   |   40/40 |              16/16 |
| F   |   20/20 |                8/8 |

K-Werte und Badges dieses Falls stehen in `referat/evidenz/2a/p50-skaliert.md`. Der Fall ist nicht
mit der rechnerischen Zeile P = 50 aus 3.1 vergleichbar.

## Ergebnis Prüfpunkt (2026-11-20, Labor lokal)

| Fall         | Session | Teilnehmende | Stimm-Zeilen | Zähler = Soll | Lernziel  |  Dauer |
| ------------ | ------- | -----------: | -----------: | :-----------: | --------- | -----: |
| P50-skaliert | 4HP8T2  |           50 |          113 |      ok       | confirmed |      – |
| P200         | 6X3D44  |          200 |          282 |      ok       | –         | 12,1 s |
| P500         | XEA84G  |          500 |          282 |      ok       | –         | 12,3 s |
| P1000        | U3V79P  |         1000 |          282 |      ok       | –         | 12,7 s |

Rohausgaben ohne Token: `referat/evidenz/seed/pruefpunkt-*.{log,json}`.
