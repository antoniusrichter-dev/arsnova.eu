# Rubrik Lageeinschätzung – Thema 2 (2A, gemeinsam genutzt von 2B und 2C)

> Bewertungsbogen für Moderationsausgaben auf dem Sechs-Fragen-Szenario
> (`referat/fixtures/sechs-fragen-szenario.json`, Issue #456 §12).
> Fünf Kriterien, je **0–2 Punkte**, Summe 0–10. Die Ankerbeispiele beziehen sich auf die
> Fixture (A–F) und die Regelkern-Baseline `referat/evidenz/2a/baseline-raumgroessen.md`.
> **Die Bewertung nehmen die Gruppenmitglieder selbst vor. Dieser Bogen enthält keine Bewertung.**

## Fixture zur Orientierung

| ID | Frage | U/D | Anliegen |
| -- | ----- | --: | -------- |
| A | Können wir mehr Beispiele zur linearen Regression bearbeiten? | 80/30 | fachlich: Übungsbedarf Regression |
| B | Gibt es ein weiteres Beispiel zur linearen Regression? | 10/0 | fachlich: Übungsbedarf Regression |
| C | Ist Kapitel 4 klausurrelevant? | 30/0 | Prüfungsrelevanz |
| D | Müssen wir den vierten Abschnitt für die Prüfung lernen? | 12/0 | Prüfungsrelevanz |
| E | Soll die Anwesenheit verpflichtend sein? | 40/40 | organisatorisch: Anwesenheitspflicht |
| F | Sollten wir eine Anwesenheitspflicht einführen? | 20/20 | organisatorisch: Anwesenheitspflicht |

Optionales bestätigtes Lernziel: „Die Studierenden können lineare Regressionsmodelle anwenden.“

Hinweis zur Einordnung von C/D: In der Produkt-Fixture (`moderation-prompt-context-fixtures.ts`)
tragen C/D die Kategorie `organization`. Für Kriterium K3 gilt das als Referenz; wer C/D
anders einordnet, begründet das in der Bemerkungsspalte.

## Kriterien und Anker

### K1 – Quellennachvollziehbarkeit

Lässt sich jede Aussage bzw. Karte auf konkrete, existierende Fragen zurückführen?

| Punkte | Anker |
| -----: | ----- |
| 2 | Jede Aussage oder Karte nennt auflösbare Quellen-IDs, und die genannten Fragen tragen die Aussage. Beispiel: Reibungskarte bei P = 50 mit `[E, F, A]` (`qa-question:5555…`, `…6666…`, `…1111…`). |
| 1 | Es gibt Quellen, aber unvollständig oder nur teilweise passend. Beispiel: „Die Anwesenheitspflicht ist umstritten“ mit Quelle nur E, obwohl F dieselbe Aussage trägt, oder eine Themenquelle ohne die zugehörigen Fragen. |
| 0 | Aussagen ohne Quelle oder mit einer Quelle, die nicht existiert bzw. die Aussage nicht trägt. Beispiel: „Viele wünschen eine Wiederholung von Kapitel 2“ ohne passende Frage. |

### K2 – Korrekte Bedeutung der Bewertungen

Werden Stimmen, Netto-Saldo, Kontroversität und Best-Score so gedeutet, wie es das Produkt definiert?

| Punkte | Anker |
| -----: | ----- |
| 2 | Stimmen werden als Stimmen behandelt, nicht als Personen. E 40/40 (Netto 0) gilt als stark geteilte Meinung und nicht als „kein Interesse“. Der Best-Score (Wilson-Untergrenze) wird nicht als Verständnismaß gelesen. Werte unter der Raumschwelle T werden als „zu wenige Stimmen“ eingeordnet (z. B. B 10/0 und D 12/0 bei P = 200, T = 20). |
| 1 | Überwiegend korrekt, eine Fehldeutung. Beispiel: A 80/30 als „klarer Konsens“ ohne Hinweis auf die 30 Gegenstimmen, oder die Raumgröße wird nicht berücksichtigt. |
| 0 | Grundlegende Fehldeutung. Beispiele: „110 Studierende wollen mehr Regressionsbeispiele“ (Stimmen = Personen), E/F als neutral oder unwichtig, weil der Netto-Saldo 0 ist, oder ein hoher Best-Score von C als „Thema verstanden“. |

### K3 – Trennung organisatorischer und fachlicher Anliegen

Werden fachliche Anliegen (A/B) von organisatorischen bzw. prüfungsbezogenen (C/D, E/F) getrennt?

| Punkte | Anker |
| -----: | ----- |
| 2 | Drei getrennte Anliegen: Übungsbedarf Regression (A/B), Prüfungsrelevanz (C/D), Anwesenheitspflicht (E/F). Die Paare werden jeweils zusammengeführt und nicht vermischt. |
| 1 | Teilweise getrennt. Beispiel: A/B als eigenes Anliegen erkannt, aber C/D und E/F zu „Organisatorisches“ zusammengelegt, oder ein Paar wird auf zwei Stellen verteilt, ohne dass der Zusammenhang erkennbar ist. |
| 0 | Keine Trennung oder eine falsche Zuordnung. Beispiel: A (Übungswunsch) zusammen mit E/F unter „Reibung“ ohne Hinweis, dass A fachlich und E/F organisatorisch sind, oder eine reine Liste ohne Gruppierung. |

### K4 – Sichtbare Unsicherheit bzw. Lücken

Macht die Ausgabe kenntlich, was fehlt, unsicher ist oder nicht berücksichtigt wurde?

| Punkte | Anker |
| -----: | ----- |
| 2 | Konkrete Lücken werden benannt. Beispiele: zu wenige Stimmen für E/F bei P = 1000 (80 bzw. 40 < T = 100), fehlende Stimmen ≠ 0/0, nicht freigegebene Quizergebnisse, PENDING-Fragen als „noch nicht moderiert“ statt als Lernstand, oder der Hinweis, dass nur ein Ausschnitt dargestellt ist. |
| 1 | Nur ein pauschaler Hinweis ohne Bezug zum Fall. Beispiel: „Eine ausführliche Zusammenfassung war nicht möglich“ ohne Angabe, was fehlt. |
| 0 | Die Ausgabe wirkt vollständig und sicher, obwohl Signale fehlen. Beispiel: P = 1000 ohne Karte und ohne Hinweis, oder eine Lernstandsbehauptung („verstehen Regression nicht“), die keine Quelle trägt. |

### K5 – Informationsumfang

Ist die Ausgabe so umfangreich wie nötig und so knapp wie möglich?

| Punkte | Anker |
| -----: | ----- |
| 2 | Alle drei Anliegen sind vertreten, ohne Wiederholung und in einem Umfang, den eine Lehrperson in der Veranstaltung erfassen kann (z. B. drei bis vier Aussagen bzw. Karten). |
| 1 | Ein Anliegen fehlt, oder es gibt deutliche Redundanz bzw. Überlänge. Beispiel: vier wörtliche Fragen, von denen zwei dasselbe Anliegen tragen und ein drittes Anliegen fehlt, oder alle sechs Fragen ohne Verdichtung. |
| 0 | Höchstens ein Anliegen ist erkennbar, oder die Menge ist in der Veranstaltung nicht mehr erfassbar (z. B. eine ungefilterte Liste mit Hunderten Fragen). |

## Bewertungsbogen

Name: Florian Meyer · Datum: 20.11.2026 · Fall/P: 200

| Variante | Ausgabe (Datei) | K1 Quellen | K2 Bewertungen | K3 Orga/Fachlich | K4 Unsicherheit | K5 Umfang | Summe (0–10) | Bemerkung |
| -------- | --------------- | :--------: | :------------: | :--------------: | :-------------: | :-------: | :----------: | --------- |
| Regelkern | 2a/baseline-raumgroessen.json | 2 | 2 | 1 | 0 | 0 | 5 | Erkennt Streit E/F korrekt mit Quellen; zeigt aber nur dieses eine Anliegen, Regression und Klausur fehlen ohne Hinweis. |
| Extraktion (extraktiver Fallback) | 2a/fallback/P200-haupt.json | 2 | 1 | 0 | 1 | 0 | 4 | Quellentreu, aber Regressions-Anliegen fehlt (3-Fragen-Kürzung); Kontroverse E/F nicht sichtbar; Lückenhinweis nur pauschal. |
| Ungefilterte Fragenliste (Gegenalternative) | fixtures/sechs-fragen-szenario.json | 2 | 1 | 0 | 1 | 1 | 5 | Alle Anliegen vorhanden, aber ungruppiert und doppelt; Streit E/F nicht gedeutet und durch Netto-Sortierung ganz unten. |

**Grenzen:** Jeder Bogen wurde von einer Person allein ausgefüllt (Entscheidung der Gruppe vom
20.11.2026); eine Übereinstimmung mehrerer Bewertender wurde nicht geprüft.
