# Auftrag 2B – Schritt 4.2: Baseline und Variante (Klassifikation 8.9b)

Stand 2026-11-21 · Commit `2b1848a1` (Produktcode 1.3.0 `efd71b44`) · Aufruf `npx tsx referat/2b/eval.ts` und `npm run eval:qa-nlp -w @arsnova/backend` · in-process, keine Dienste nötig.

Dateien: `ergebnis.json` (alle Kennzahlen), `vorhersagen.csv` (480 Zeilen = 80 Fragen × 2 Methoden × 3 Schwellen), `uebersicht.md`, `eval-qa-nlp-repo-seed.json` (Referenzlauf auf dem Repo-Seed).

## Aufbau

- **Referenzmenge:** `referat/2b/referenz.csv` mit 80 Fragen.
  - Sprachen: 36 DE, 24 EN, 10 FR, 10 ES.
  - Gruppen: 21 Paraphrasen, 17 mehrdeutig, 14 kurz, 11 Tippfehler, 11 Slang, 6 Fixture.
  - Gold: 41 organization, 25 content, 14 technical.
- **Labeling:**
  - Gold ist `label_person1`; es gibt nur eine labelnde Person.
  - **Cohen's κ und Uneinigkeit lassen sich nicht berechnen** (in `ergebnis.json` als `null` mit Begründung). Das ist eine Grenze des Versuchs.
- **Methoden:**
  - Kaskade: `classifyQaNlpCascade`, Gatekeeper `gatekeeper-hash-nb-v1` mit Early-Exit (Abstand ≥ 0,22, ≥ 6 Tokens), sonst `fallback-knn-v1`.
  - Keyword-Baseline: `predictQaNlpKeywordBaseline`. Sie gilt als classified, wenn die Konfidenz ≥ der Schwelle ist, wie in `evaluateQaNlpPredictions`.
- **Variante:** Nur `QA_NLP_MIN_CONFIDENCE` wird verändert, auf 0,45 / 0,55 (Default) / 0,65.
- **Macro-F1** wird in drei benannten Lesarten ausgegeben:
  - *classified*: nur klassifizierte Fälle.
  - *streng*: `uncertain` zählt als falsch.
  - *Bestes Label*: gilt für alle Fälle und entspricht der Produktdefinition.

## Ergebnis je Variante

| Variante | Abdeckung | Accuracy (classified) | Macro-F1 classified | Macro-F1 streng | Macro-F1 Bestes Label | Accuracy Bestes Label | ECE |
| -------- | --------: | --------------------: | ------------------: | --------------: | --------------------: | --------------------: | --: |
| kaskade@0.45 | 71,3 % (57/80) | 68,4 % | 0,675 | 0,567 | 0,598 | 60,0 % | 0,258 |
| kaskade@0.55 (Default) | 73,8 % (59/80) | 67,8 % | 0,670 | 0,571 | 0,598 | 60,0 % | 0,258 |
| kaskade@0.65 | 73,8 % (59/80) | 66,1 % | 0,656 | 0,559 | 0,588 | 58,8 % | 0,269 |
| keyword@0.45 | 42,5 % (34/80) | 47,1 % | 0,495 | 0,293 | 0,351 | 40,0 % | 0,215 |
| keyword@0.55 (Default) | 38,8 % (31/80) | 51,6 % | 0,546 | 0,300 | 0,351 | 40,0 % | 0,215 |
| keyword@0.65 | 38,8 % (31/80) | 51,6 % | 0,546 | 0,300 | 0,351 | 40,0 % | 0,215 |

## Je Fallgruppe (Schwelle 0,55)

| Gruppe | n | Kaskade Abdeckung | Kaskade Acc. classified | Keyword Abdeckung | Keyword Acc. classified |
| ------ | -: | ----------------: | ----------------------: | ----------------: | ----------------------: |
| fixture | 6 | 67 % | 100 % | 100 % | 67 % |
| kurz | 14 | 43 % | 100 % | 50 % | 43 % |
| mehrdeutig | 17 | 76 % | 54 % | 29 % | 20 % |
| paraphrase | 21 | 90 % | 68 % | 24 % | 100 % |
| slang | 11 | 73 % | 50 % | 45 % | 60 % |
| tippfehler | 11 | 82 % | 67 % | 27 % | 0 % |

## Je Sprache (Schwelle 0,55)

| Sprache | n | Kaskade Abdeckung | Kaskade Acc. classified | Keyword Abdeckung | Keyword Acc. classified |
| ------- | -: | ----------------: | ----------------------: | ----------------: | ----------------------: |
| de | 36 | 75 % | 67 % | 50 % | 56 % |
| en | 24 | 71 % | 71 % | 46 % | 55 % |
| es | 10 | 60 % | 83 % | 10 % | 0 % |
| fr | 10 | 90 % | 56 % | 10 % | 0 % |

## Konfusionsmatrix kaskade@0.55 (Zeile = Gold, Spalte = Vorhersage)

| Gold \ Vorhersage | content | organization | technical | uncertain |
| ----------------- | ------: | -----------: | --------: | --------: |
| content | 17 | 1 | 3 | 4 |
| organization | 10 | 16 | 2 | 13 |
| technical | 1 | 2 | 7 | 4 |

## Konfusionsmatrix keyword@0.55 (Zeile = Gold, Spalte = Vorhersage)

| Gold \ Vorhersage | content | organization | technical | uncertain |
| ----------------- | ------: | -----------: | --------: | --------: |
| content | 8 | 1 | 0 | 16 |
| organization | 11 | 5 | 1 | 24 |
| technical | 0 | 2 | 3 | 9 |

## Reliability kaskade@0.55 (ECE 0,258)

| Konfidenz-Bin | n | davon classified | mittlere Konfidenz | Trefferquote | Lücke |
| ------------- | -: | ---------------: | -----------------: | -----------: | ----: |
| 0,3–0,4 | 2 | 0 | 0,38 | 0,00 | +0,38 |
| 0,4–0,5 | 2 | 0 | 0,46 | 0,00 | +0,46 |
| 0,5–0,6 | 4 | 0 | 0,56 | 0,75 | -0,19 |
| 0,6–0,7 | 15 | 14 | 0,64 | 0,53 | +0,10 |
| 0,7–0,8 | 5 | 4 | 0,76 | 0,60 | +0,16 |
| 0,8–0,9 | 8 | 7 | 0,84 | 0,75 | +0,09 |
| 0,9–1,0 | 44 | 34 | 0,98 | 0,64 | +0,34 |

## Reliability keyword@0.55 (ECE 0,215)

| Konfidenz-Bin | n | davon classified | mittlere Konfidenz | Trefferquote | Lücke |
| ------------- | -: | ---------------: | -----------------: | -----------: | ----: |
| 0,3–0,4 | 46 | 0 | 0,33 | 0,35 | -0,01 |
| 0,5–0,6 | 3 | 0 | 0,50 | 0,00 | +0,50 |
| 0,9–1,0 | 31 | 31 | 1,00 | 0,52 | +0,48 |

## Die 10 auffälligsten Fehler kaskade@0.55

Sortierung: zuerst classified, dann nach Konfidenz absteigend. Begründungen: KI-Entwurf (Claude, 21.11.2026), von Jeremy Richter geprüft und freigegeben. Mit „Vermutung“ markierte Ursachen sind nicht gemessen.

| ID | Text | Gruppe | Gold | Vorhersage | Status | Konfidenz | Stufe | Begründung |
| -- | ---- | ------ | ---- | ---------- | ------ | --------: | ----- | ---------- |
| R059 | Do we need to know the derivation? | mehrdeutig | organization | content | classified | 1,000 | gatekeeper-hash-nb-v1 | Prüfungsrelevanz-Konvention: Der Seed labelt die fast gleiche Frage („Herleitung … pruefungsrelevant?“, Z. 416) als `content`. Das Modell folgt dem Seed. |
| R063 | Est-ce que la séance sera enregistrée ? | paraphrase | organization | content | classified | 1,000 | gatekeeper-hash-nb-v1 | Aufzeichnung kommt im Seed in keiner Sprache vor („Aufzeichnung“, „recording“, „enregistr“: 0 Treffer). Französisch ist nur schwach vertreten. Trotzdem Konfidenz 1,0 → Überkonfidenz bei unbekanntem Thema. |
| R069 | Est-ce que c'est important pour la suite ? | mehrdeutig | organization | content | classified | 0,999 | gatekeeper-hash-nb-v1 | Mehrdeutig (Relevanz für Prüfung oder für Verständnis?). Gleiche Konventionsfrage wie R059. |
| R015 | Warum folgt aus einem Zusammenhang nicht automatisch eine Ursache? | paraphrase | content | technical | classified | 0,998 | gatekeeper-hash-nb-v1 | Echter Modellfehler. „Zusammenhang“ und „Ursache“ fehlen im Seed. *Vermutung:* Ähnlichkeit zu „warum geht … nicht“-Mustern aus Technikfragen. |
| R024 | Check ich nicht, wieso ist das Intervall so breit? | slang | content | technical | classified | 0,972 | gatekeeper-hash-nb-v1 | Echter Modellfehler, obwohl der Seed „Konfidenzintervall erklären“ und „Ich check den Loesungsweg null“ als `content` kennt. *Vermutung:* „wieso … nicht“ zieht Richtung Technik. |
| R042 | Will the recording be available after class? | paraphrase | organization | content | classified | 0,971 | gatekeeper-hash-nb-v1 | Wie R063: Thema Aufzeichnung fehlt im Seed. |
| R034 | Kann man die Übungsaufgaben auch in R statt Python lösen? | mehrdeutig | organization | content | classified | 0,969 | gatekeeper-hash-nb-v1 | Regel 5 (Werkzeug erlaubt = org) ist unsere Festlegung. „Übungsaufgaben“ und Programmiersprachen klingen fachlich. *Vermutung:* Ohne Seed-Beispiel zu erlaubten Werkzeugen greift das Fachvokabular. |
| R035 | Wie viel Zeit sollten wir für die Hausaufgabe einplanen? | mehrdeutig | organization | content | classified | 0,961 | gatekeeper-hash-nb-v1 | Mehrdeutig. „Hausaufgabe“ kommt im Seed nicht vor. *Vermutung:* Ähnliche Zeichenfolgen zu „Aufgabe“ aus Fach-Seeds ziehen Richtung `content`. |
| R078 | Ni idea de lo que es un p-valor, ¿lo explicas otra vez? | slang | content | organization | classified | 0,959 | gatekeeper-hash-nb-v1 | Slang und Spanisch. „otra vez“ steht im Seed sowohl bei `content` als auch bei `technical`. Warum `organization` herauskommt, ist ungeklärt → offen lassen. |
| R067 | Je n'arrive pas a me connecter a la plateform | tippfehler | technical | organization | classified | 0,952 | gatekeeper-hash-nb-v1 | Tippfehler und fehlende Akzente verändern die Zeichen-n-Gramme. „connect“/„plataforma“ kommen im Seed nicht vor. |

**Drei Fehlermuster:**
1. **Konvention** (R059, R069, R034, R035): Das Modell ist nicht falsch, sondern folgt einer anderen Festlegung als unsere Labelregeln.
2. **Lücken im Seed** (R063, R042, R067, R078): Themen bzw. Sprachen, die im Trainings-Seed fehlen oder schwach sind (FR/ES je ca. 23 von 187 Einträgen).
3. **Echte Fehlzuordnung** (R015, R024): fachliche Fragen, die als Technik gelesen werden.

Alle zehn haben Konfidenz ≥ 0,95. **Die gefährlichsten Fehler sind die sichersten.** Die Lehrperson bekommt kein „unsicher“ angezeigt.

## Die 10 auffälligsten Fehler keyword@0.55

Sortierung: zuerst classified, dann nach Konfidenz absteigend. Die Spalte Begründung bleibt frei; sie ist Eigenleistung.

| ID | Text | Gruppe | Gold | Vorhersage | Status | Konfidenz | Stufe | Begründung |
| -- | ---- | ------ | ---- | ---------- | ------ | --------: | ----- | ---------- |
| R003 | Ist Kapitel 4 klausurrelevant? | fixture | organization | content | classified | 1,000 | keyword-baseline |  |
| R004 | Müssen wir den vierten Abschnitt für die Prüfung lernen? | fixture | organization | content | classified | 1,000 | keyword-baseline |  |
| R007 | Klausur wann? | kurz | organization | content | classified | 1,000 | keyword-baseline |  |
| R020 | Gibts die Folein auch als PDF? | tippfehler | organization | technical | classified | 1,000 | keyword-baseline |  |
| R021 | Mein Bildschrim bleibt schwarz, wenn ich den Link öffne | tippfehler | technical | organization | classified | 1,000 | keyword-baseline |  |
| R034 | Kann man die Übungsaufgaben auch in R statt Python lösen? | mehrdeutig | organization | content | classified | 1,000 | keyword-baseline |  |
| R035 | Wie viel Zeit sollten wir für die Hausaufgabe einplanen? | mehrdeutig | organization | content | classified | 1,000 | keyword-baseline |  |
| R036 | Brauchen wir für die Klausur einen Taschenrechner, und welcher ist erlaubt? | mehrdeutig | organization | content | classified | 1,000 | keyword-baseline |  |
| R037 | Exam date? | kurz | organization | content | classified | 1,000 | keyword-baseline |  |
| R049 | The link to the quizz doesn't open on my phone | tippfehler | technical | organization | classified | 1,000 | keyword-baseline |  |

## Sensitivität: Labelkonvention Prüfungsrelevanz

Labelregel 2 (`referat/2b/labelregeln.md`, Z. 40) ordnet Prüfungsrelevanz `organization` zu, wie in der Fixture-Erwartung C/D. Das Produkt behandelt solche Fragen als `content`:
- Repo-Seed `apps/backend/src/lib/qaNlpSeed.ts`, Z. 60 („Ist Aufgabe 3 klausurrelevant?“) und Z. 416 („Ist die Herleitung auf Folie 7 pruefungsrelevant?“).
- Keyword-Lexikon `qaNlpKeywordBaseline.ts`: `klausur`, `pruefung`, `exam` und `relevant` stehen unter `content`.

Ohne die 10 Fragen, die das Muster `klausur|prüfung|pruefung|exam|examen|relevant|kommt .* dran|au programme` treffen, bleiben n = 70. Die Labels sind unverändert. Das Muster trifft auch reine Terminfragen wie „Klausur wann?“, deshalb muss die labelnde Person die ausgeschlossenen IDs prüfen: R003, R004, R007, R026, R036, R037, R053, R057, R061, R071.

**Prüfung der 10 IDs** (KI-Entwurf Claude, von Jeremy Richter geprüft und freigegeben; kein Label geändert). Alle 10 sind mit `organization` gelabelt. Das Suchmuster fasst drei verschiedene Fallarten zusammen; nur ein Teil davon ist wirklich ein Konflikt mit dem Produkt.

| Art | IDs | Text (gekürzt) | Bewertung |
|---|---|---|---|
| **Termin** (kein Konflikt) | R007, R037, R061, R071 | Klausur wann? · Exam date? · Quand est l'examen ? · ¿Cuándo es el examen? | Reine Terminfrage, eindeutig `organization` (Regel 1). Vom Muster nur fälschlich erfasst. |
| **Hilfsmittel** (kein Konflikt) | R036 | Taschenrechner erlaubt? | `organization` nach Regel 5 („ob ein Werkzeug erlaubt ist“). |
| **Prüfungsrelevanz** (echter Konflikt) | R003, R004, R026, R057 | Kapitel 4 klausurrelevant? · vierten Abschnitt lernen? · Kommt das Zeug alles dran? · Is this going to be relevant? | `organization` nach Regel 2 = Konvention der #456-Fixture (C/D). Der Produkt-Seed sieht hier `content`. |
| **Erwartung an die Prüfung** (Grenzfall) | R053 | is the exam gonna be brutal or chill? | Eher `organization` (Rahmen der Prüfung, kein Fachstoff). Als mehrdeutig notieren. |

**Das Repo ist bei Prüfungsrelevanz uneinheitlich, sogar innerhalb des Seeds** (Zeilen am Code in `efd71b44` verifiziert):
- #456-Fixture: C/D (Prüfungsrelevanz) = `organization`
- Seed `qaNlpSeed.ts:416`: „Ist die Herleitung auf Folie 7 pruefungsrelevant?“ = `content`
- Seed `qaNlpSeed.ts:1049`: „Is this important?“ = `organization`

Die Kategorie hängt also an einer Konvention, die das Produkt selbst nicht einheitlich festlegt. Das Problem liegt damit nicht nur beim Modell.

**Sensitivität 1 – ohne alle 10 Muster-IDs** (n = 70):

| Variante | Abdeckung | Acc. classified | Macro-F1 classified | Macro-F1 streng | Macro-F1 Bestes Label |
| -------- | --------: | --------------: | ------------------: | --------------: | --------------------: |
| kaskade@0.45 | 73 % | 69 % | 0,679 | 0,572 | 0,601 |
| kaskade@0.55 | 74 % | 67 % | 0,668 | 0,568 | 0,601 |
| kaskade@0.65 | 74 % | 65 % | 0,650 | 0,552 | 0,588 |
| keyword@0.45 | 36 % | 64 % | 0,628 | 0,337 | 0,389 |
| keyword@0.55 | 31 % | 73 % | 0,711 | 0,349 | 0,389 |
| keyword@0.65 | 31 % | 73 % | 0,711 | 0,349 | 0,389 |

**Sensitivität 2 – nur ohne die 5 echten Konfliktfälle** R003, R004, R026, R053, R057 (n = 75). Termin- und Hilfsmittelfragen (R007, R036, R037, R061, R071) bleiben drin; Labels unverändert. Quelle: `ergebnis.json` → `sensitivitaetKonfliktfaelle`.

| Variante | Abdeckung | Acc. classified | Macro-F1 classified | Macro-F1 streng | Macro-F1 Bestes Label |
| -------- | --------: | --------------: | ------------------: | --------------: | --------------------: |
| kaskade@0.45 | 72 % | 70 % | 0,697 | 0,585 | 0,612 |
| kaskade@0.55 | 73 % | 69 % | 0,686 | 0,581 | 0,612 |
| kaskade@0.65 | 73 % | 67 % | 0,670 | 0,567 | 0,601 |
| keyword@0.45 | 40 % | 53 % | 0,542 | 0,311 | 0,369 |
| keyword@0.55 | 36 % | 59 % | 0,603 | 0,320 | 0,369 |
| keyword@0.65 | 36 % | 59 % | 0,603 | 0,320 | 0,369 |

## Referenz: `eval:qa-nlp` auf dem Repo-Seed

- **Kaskade:** n = 100, Abdeckung 85 %, Accuracy (classified) 87,1 %; Early-Exit 49 %, Fallback 51 %.
- **Gatekeeper-NB @0,55:** Accuracy (classified) 83,5 %, Macro-F1 (Bestes Label) 0,818.
- **Keyword-Baseline @0,55:** Accuracy (classified) 94,0 %, Abdeckung 67 %, Macro-F1 (Bestes Label) 0,727.
- **Operating Point laut Produkt:** 0.55 („Default 0.55 bleibt: Classified-Accuracy 0.835, Uncertain-Rate 0.030 unter Fallback-Budget 0.3.“). Seine Accuracy- und Uncertain-Werte beziehen sich auf den Gatekeeper allein, nicht auf die Kaskade.

## Beobachtungen (ohne Bewertung; Entscheidung und Interpretation sind Eigenleistung)

1. **Abstand Kaskade – Keyword** bei der Default-Schwelle 0,55:
   - Macro-F1 streng 0,571 gegenüber 0,300 (+27 pp), Bestes Label 0,598 gegenüber 0,351 (+25 pp).
   - Abdeckung 74 % gegenüber 39 %, Accuracy (classified) 68 % gegenüber 52 %.
2. **Vergleich mit den Vorschlagsschwellen des Plans** (Precision auf classified ≥ 0,85 bei Abdeckung ≥ 60 %; Kaskade ≥ 10 pp Macro-F1 über Keyword):
   - Die Precision-Bedingung erfüllt keine Variante; der Höchstwert liegt bei 68 %.
   - Den Macro-F1-Abstand erfüllen alle Kaskaden-Varianten.
3. **Übertragbarkeit:** Auf dem Repo-Seed erreicht die Kaskade 87 % Accuracy (classified), auf der eigenen Menge 68 %. Die Seed-Zahlen übertragen sich nicht. Auf dem Repo-Seed liegt die Keyword-Baseline (classified) mit 94 % sogar vor dem Gatekeeper (83,5 %); auf der eigenen Menge kehrt sich das um.
4. **Die Schwelle wirkt kaum und nicht monoton.**
   - Von 0,45 auf 0,55 *steigt* die Abdeckung, von 57 auf 59. Ursache: R013 und R053 sind bei 0,45 uncertain und bei 0,55 classified.
   - Der k-NN-Fallback wird nur übernommen, wenn er mit dem Gatekeeper übereinstimmt oder die Gatekeeper-Konfidenz *unter* der Schwelle liegt (`qaNlpCascade.ts`, `classifyQaNlpCascade`). Eine niedrigere Schwelle blockiert ihn also häufiger.
   - Von 0,55 auf 0,65 ändern sich Abdeckung und Accuracy nur um ein bis zwei Fälle.
5. **Konfidenz ist nicht kalibriert.**
   - Kaskade @0,55: Im Bin 0,9–1,0 liegen 44 Fälle mit einer Trefferquote von nur 64 %; ECE 0,26.
   - Die zehn auffälligsten Fehler sind alle Early-Exits des Gatekeepers mit Konfidenz ≥ 0,95.
   - Bei der Keyword-Baseline ist die Konfidenz praktisch binär: Ohne Treffer liegt sie bei 1/3, mit Treffern einer einzigen Kategorie bei 1,0.
6. **Gruppen:**
   - Bei Kurzfragen hat die Kaskade 43 % Abdeckung und 100 % Accuracy (classified); das passt zur Mindestlänge von 6 Tokens für den Early-Exit.
   - Slang und mehrdeutige Fragen liegen bei 50–54 % Accuracy (classified).
   - Die Keyword-Baseline deckt in FR und ES je nur 1 von 10 Fragen ab.
7. **Fixture:**
   - Die Kaskade ordnet A, B, D und E richtig zu. C und F sind uncertain; das beste Label wäre für C content (laut Labelregel falsch) und für F organization (richtig).
   - Die Keyword-Baseline ordnet C und D als content ein.
8. **Labelkonvention:** Die Konvention zur Prüfungsrelevanz trifft vor allem die Keyword-Baseline. Ohne die zehn betroffenen Fragen steigt ihre Accuracy (classified) auf 73 %; bei der Kaskade ändern sich die Werte kaum.
