# Labelregeln Referenzmenge 2B (Klassifikation 8.9b)

Gilt für `referat/2b/referenz.csv` (80 Fragen, Spalte `label_person1`).
**Die Labels vergibt eine Person allein (Entscheidung der Gruppe vom 20.11.2026: keine Zweitbewertung).**

## Zulässige Werte

Genau einer dieser drei Werte pro Zeile, kleingeschrieben wie im Produkt (`QaNlpCategoryEnum`,
`libs/shared-types/src/schemas.ts:164`):

| Wert | Bezeichnung im Produkt |
| ---- | ---------------------- |
| `content` | Inhalt, „Inhaltliche Fragen“ |
| `organization` | Organisation bzw. Ablauf, „Fragen zum Ablauf“, „Ablauf & Zeit“ |
| `technical` | Technik, „Technik oder Verbindung“ |

## Was die Produktdoku festlegt (Quellen)

- `docs/features/qa-nlp-moderation.md` (Abschnitt Zweck): Kategorie `content` / `organization` / `technical` als **Host-only Hilfssignal**,
  ergänzt um Unsicherheit (`uncertain`). In der Host-UI erscheinen klassifizierte Fragen in der Karte „Häufige Themen“ als
  **Inhalt, Ablauf und Technik**. Keine automatischen Moderationsaktionen.
- ADR-0032 (`docs/architecture/decisions/0032-optional-nlp-cascade-for-qa-moderation-signals.md`, Kontext): „thematische Einordnung
  eingereichter Q&A-Fragen, z. B. `Inhalt`, `Organisation`, `Technik`“.
- Frontend-Texte (`apps/frontend/src/locale/messages.xlf`): „Die Fragen sind nach Inhalt, Organisation und Technik geordnet.“,
  „Fragen zum Ablauf“, „Ablauf & Zeit“, „Technik oder Verbindung“.
- Referenz-Fixture (`libs/shared-types/src/moderation-prompt-context-fixtures.ts:170`): A/B (Regressionsbeispiele) = `content`,
  C/D (Prüfungsrelevanz) und E/F (Anwesenheitspflicht) = `organization`.
- `qa-nlp-moderation.md` (Kalibrierung und Seed-Qualität): mehrdeutige Fragen haben im Produkt-Seed nur ein „Best-Effort“-Gold-Label und zählen nicht in F1.

Mehr regelt die Doku nicht. Es gibt dort **keine** ausformulierte Abgrenzung der drei Kategorien.

## Operationalisierung (Vorschlag für die Gruppe, nicht aus der Doku)

Vor dem Labeln gemeinsam bestätigen oder ändern; Änderungen hier mit Datum eintragen.

1. **Leitfrage:** Was müsste die Lehrperson tun, um die Frage zu beantworten?
   - Fachstoff erklären, ein Beispiel rechnen oder eine Methode, ein Ergebnis oder eine Interpretation einordnen → `content`
   - Rahmen der Veranstaltung klären (Termine, Fristen, Prüfung, Bewertung, Anwesenheit, Aufzeichnung, Material und Bereitstellung, Ablauf, Pausen) → `organization`
   - Eine Störung von Gerät, Netz, Ton/Bild, Plattform, App, Login oder Upload beheben → `technical`
2. **Prüfungsrelevanz** („kommt das dran?“, „ist Kapitel X klausurrelevant?“) → `organization` (wie Fixture C/D), auch wenn ein Fachthema genannt wird.
3. **Wunsch nach mehr Beispielen oder Erklärungen zu einem Thema** → `content` (wie Fixture A/B).
4. **Material** („Folien online?“, „gibt es mehr Material zu Kapitel 5?“) → `organization` (Bereitstellung). Nur wenn nach dem Inhalt gefragt wird → `content`.
5. **Software als Lernwerkzeug:** Fehler im eigenen Rechenweg oder Code, der fachlich falsch ist → `content`; Programm oder Plattform funktioniert nicht → `technical`; ob ein Werkzeug erlaubt ist → `organization`.
6. **Mischfragen:** Das Anliegen zählt, das die Lehrperson zuerst lösen muss. Bei Gleichstand gilt die Reihenfolge `technical` vor `organization` vor `content` (eine blockierende Störung zuerst).
7. **Unklare Kurz- oder Bezugsfragen** („Ist das wichtig?“, „Können wir das nochmal machen?“): Lesart ohne Vorlesungskontext wählen, also nur nach dem Wortlaut; trotzdem genau ein Label. Die Unsicherheit wird nicht in der CSV markiert, sondern unten unter „Notizen“ mit der ID festgehalten.
8. **Sprache, Tippfehler, Slang** ändern das Label nicht; maßgeblich ist der gemeinte Inhalt.

Bestätigt am 20.11.2026.

## Ablauf

1. Regeln gemeinsam bestätigen (vor dem ersten Label).
2. Eine Person labelt alle 80 Zeilen in der Spalte `label_person1`, genau ein Label pro Zeile.
3. Die Gruppe `mehrdeutig` getrennt auswerten (analog zum Produkt-Seed, in dem `ambiguous` nicht in F1 eingeht) und das in 2B begründen.

## Aufbau der Referenzmenge

| Merkmal | Verteilung |
| ------- | ---------- |
| Sprache | de 36 (davon 6 Fixture), en 24, fr 10, es 10 |
| Gruppe | fixture 6, kurz 14, paraphrase 21, tippfehler 11, slang 11, mehrdeutig 17 |

- `fixture` = R001–R006, wörtlich die Fragen A–F aus `referat/fixtures/sechs-fragen-szenario.json`.
- `paraphrase`: Je zwei aufeinanderfolgende Zeilen bilden ein Paar gleicher oder eng verwandter Bedeutung (z. B. R012/R013 Aufzeichnung, R014/R015 Korrelation/Kausalität). R018 (Seite lädt nicht) hat keinen Partner. Bei FR/ES (je 2 Paare) ist das zweite Paar nur thematisch verwandt (Streuung bzw. Kennzahlen).
- Die Texte sind neu formuliert und nicht aus `apps/backend/src/lib/qaNlpSeed.ts` kopiert. Abgleich (normalisiert, `difflib`-Ähnlichkeit) gegen alle 186 Seed-Texte: kein identischer Text, keine Ähnlichkeit ≥ 0,75 außer Fixture C (0,79 zu einem Seed-Text, bleibt wörtlich aus der Fixture). Vier zu nahe Vorschläge wurden vorher ersetzt. Ergebnis: `referat/evidenz/2b/seed-abgleich.json`; Erzeugung: `referat/2b/referenz_erzeugen.py`.

## Notizen (beim Labeln ergänzen)

| ID | Person | Notiz |
| -- | ------ | ----- |
| | | |

## Grenzen

- Die Referenz wurde von einer Person gelabelt; eine Übereinstimmung mehrerer Bewertender wurde nicht geprüft.
