# KI-Offenlegung – Referat Thema 2 (Gruppe 8)

> Stand 2026-11-22 · Branch `referat/thema2-gruppe8` · Produktcode 1.3.0 (`efd71b44`).
> Grundlage: Runbook `runbook-claude-code-thema2.md` (ein Prompt pro Schritt), `referat/evidenz/protokoll.md` und die Git-Historie des Branches.
> Die Spalte **„Von uns geprüft/korrigiert“** füllen die Gruppenmitglieder selbst aus. Sie ist absichtlich leer.

## Werkzeug und Modell

- **Werkzeug:** Claude Code (Anthropic), CLI in WSL2 (Ubuntu) auf dem Rechner von Antonius Richter. Version dieser Sitzung: 2.1.330.
- **Modell:** Claude Opus 5.5 (`claude-opus-5-5`) in der Sitzung vom 2026-11-21 (Nachträge 4.2, Schritte 6.1 und 6.2). Für frühere Sitzungen (2026-11-17 bis 2026-11-21) wurde das Modell nicht protokolliert. *Bitte ergänzen.*
- **Arbeitsweise:** Je Runbook-Schritt ein Prompt. Claude Code hat Code und Skripte geschrieben, Befehle nur gegen Loopback-Ziele ausgeführt und Ergebnisse protokolliert. Regeln für alle Sitzungen stehen in `CLAUDE.md`: Produktcode nicht ändern, keine Secrets, keine SaaS-LLMs als Versuchsmodell, Commits je Auftrag mit dem jeweiligen Autor.
- **Nicht durch KI:** Hypothesen und Entscheidungsschwellen, Labels der Referenzmenge (2B), Interpretation. Das Handout 2C ist ein Entwurf von Claude Code, von Antonius Richter geprüft und überarbeitet (siehe unten). Ausnahmen, in denen die KI Bewertungs- oder Interpretationstexte **entworfen** hat, stehen unten gesondert.
- **Prompts:** Die Prompt-Texte stehen im Runbook. Es wurden keine Secrets, `.env`-Inhalte oder Tokens in Prompts übergeben.

## Schritte

| Schritt | Auftrag | Zweck | Erzeugte bzw. geänderte Dateien | Art des KI-Beitrags | Von uns geprüft/korrigiert |
| ------- | ------- | ----- | ------------------------------- | ------------------- | -------------------------- |
| 1.1 | gemeinsam | Leitplanken, Branch | `CLAUDE.md` (später Commit-Regeln, `028cff50`) | Datei nach wörtlicher Vorgabe angelegt | ✓ |
| 1.2 | gemeinsam | Referenzmanifest (Hardware, Versionen, Flags mit Fundstelle) | `referat/evidenz/manifest.md` | Daten erhoben, Flags aus den Dokus zusammengestellt | ✓ |
| 2.1 | gemeinsam | Basis-Stack lokal starten, Smoke-Test | `referat/evidenz/labor/`, `referat/evidenz/protokoll.md` | Befehle ausgeführt, Ergebnisse protokolliert | ✓ |
| 2.2 | gemeinsam | Fixture „Sechs-Fragen-Szenario“ (Issue #456 §12) und Seed mit Raumgröße P | `referat/fixtures/{sechs-fragen-szenario.json,seed-sechs-fragen.ts,README.md}`, `referat/evidenz/seed/` | Code geschrieben, Seed ausgeführt | ✓ |
| 3.1 | 2A | Regelkern über P = 50/200/500/1000 | `referat/2a/{regelkern-raumgroessen.test.ts,lib/regelkern.ts,vitest.config.ts}`, `referat/evidenz/2a/baseline-raumgroessen.*` | Testharness geschrieben, Abgleich mit Plan §0.2 | ✓ |
| 3.1 (Nachtrag) | 2A | Fall „P50-skaliert“ (P = 50 nicht realisierbar) | `referat/2a/p50-skaliert.test.ts`, `referat/evidenz/2a/p50-skaliert.*` | Befund und Testfall vorgeschlagen und umgesetzt | ✓ |
| 3.2 | 2A | Gegenfälle | `referat/2a/gegenfaelle.test.ts`, `referat/evidenz/2a/gegenfaelle.*` | Erwartungen vorab notiert, Tests geschrieben | ✓ |
| 3.3 | 2A | Extraktiver Fallback im Releasepfad, Störungen `queue_full` und `source_changed` | `referat/2a/fallback/fallback-lauf.ts`, `referat/evidenz/2a/fallback/` | Skript geschrieben, Backend-Läufe ausgeführt | ✓ |
| 3.4 | 2A | Aufwand (Microbenchmark) | `referat/2a/bench/aufwand.bench.ts`, `referat/evidenz/2a/aufwand*` | Benchmark geschrieben und ausgeführt | ✓ |
| 3.5 | 2A | Rubrikbogen (Kriterien, Anker) | `referat/evidenz/rubrik.md` | Bogen entworfen, ohne Bewertung | ✓ |
| 3.5 (Bewertung) | 2A | **Beispielbewertungen** der Rubrik für Regelkern, Extraktion und ungefilterte Fragenliste (P = 200) | `referat/evidenz/rubrik.md`, Abschnitt „Bewertungsbogen“ | **KI-Entwurf (Claude), von Florian Meyer geprüft** (Angabe der Gruppe, im Protokoll nicht vermerkt) | ✓ |
| 4.1 | 2B | Referenzmenge (80 Fragen) und Labelregeln | `referat/2b/{referenz.csv,referenz_erzeugen.py,labelregeln.md}` | Fragen und Regeln vorgeschlagen; **Labels nicht von der KI** (`label_person1` von Jeremy Richter) | ✓ |
| 4.2 | 2B | Evaluation Kaskade gegen Keyword-Baseline bei drei Schwellen, Referenzlauf `eval:qa-nlp` | `referat/2b/eval.ts`, `referat/evidenz/2b/eval/` | Auswertungsskript geschrieben und ausgeführt | ✓ |
| 4.2 (Nachtrag) | 2B | **Fehlerbegründungen**, Fehlermuster, Einordnung der 10 Sensitivitäts-IDs, Sensitivität 2 (ohne 5 Konfliktfälle) | `referat/evidenz/2b/eval/ergebnis.md`, `ergebnis.json`, `referat/2b/eval.ts` | **KI-Entwurf (Claude), von Jeremy Richter geprüft und freigegeben**; Sensitivität 2 von der KI gerechnet | ✓ |
| 4.2 (Korrektur) | 2B | Seed-Belege in den Begründungen korrigiert (Seed-Größe, Z. 423, Train-/Eval-Split) | `referat/evidenz/2b/eval/ergebnis.md` | Fehler im eigenen KI-Entwurf (Trainings- vs. Eval-Split nicht beachtet), von der KI bei der Prüfung gefunden und korrigiert; **von Jeremy Richter geprüft und freigegeben** | ✓ |
| 4.2 (Entscheidung) | 2B | **Entscheidung**, Voraussetzungen, Betriebsfolge, Grenzen | `referat/evidenz/2b/entscheidung.md` | **KI-Entwurf (Claude), von Jeremy Richter geprüft und freigegeben** | ✓ |
| 4.3 | 2B | Laufzeit und Burst (200 `qa.submit`, Queue-Limit 100/20) | `referat/2b/{burst.ts,burst-alle.sh,burst-auswertung.ts,start-backend.sh}`, `referat/evidenz/2b/last/` | Skripte geschrieben, Läufe ausgeführt | ✓ |
| 4.4 | 2B | Kontextschnittstelle (#456 nur mit persistierten Kategorien) | `referat/2b/kontext-pruefung.ts`, `referat/evidenz/2b/kontext.md`, `referat/evidenz/2b/kontext/` | Prüfskript geschrieben, Live-Prüfung und Produkttests ausgeführt | ✓ |
| 5.1 | 2C | Private Runtime (GGUF revisionsgebunden, SHA-256, Health-Probe) | `referat/2c/runtime/`, `referat/evidenz/2c/runtime/`, Manifest | Befehle ausgeführt und protokolliert | ✓ |
| 5.2 | 2C | Baseline full-context, Fälle a–d × 5 Läufe | `referat/2c/{baseline-lauf.mjs,baseline-alle.sh,fall.sh,llm-proxy.mjs,start-backend.sh,seed-issue456-teilmenge.ts}`, `referat/evidenz/2c/{baseline,seed}/` | Skripte geschrieben, Läufe ausgeführt | ✓ |
| 5.3 | 2C | Ablationen „nur Texte“ und „Texte + Metadaten“, Wiederholung nach OOM | `referat/2c/{ablation-harness.ts,ablation-alle.sh,start-harness.sh}`, `referat/evidenz/2c/ablation*/` | Harness geschrieben (Versuchscode), Läufe ausgeführt, OOM dokumentiert | ✓ |
| 5.4 | 2C | Auswertung, Gate-Gründe, Quellentreue-Bogen (leer) | `referat/2c/{auswertung.ts,gate-gruende.py,bogen-kompakt.py}`, `referat/evidenz/2c/{auswertung*,gate-gruende.txt,quellentreue-bogen*.csv}` | Auswertung geschrieben; Bogen **ohne Bewertung** | ✓ |
| 5.4 (Bewertung) | 2C | **Bewertung des Quellentreue-Bogens** (Kompaktfassung, 93 Zeilen, Fehlerklassen und Bemerkungen) | `referat/evidenz/2c/quellentreue-bogen-kompakt.csv` | **KI-Entwurf (Claude), von Antonius Richter geprüft** | ✓ |
| 5.4 (Auswertung Bogen) | 2C | Prüfung des Bogens, Fehlerklassen je Fall und Variante, Befund 6, Abbildung | `referat/2c/quellentreue.ts`, `referat/evidenz/2c/{quellentreue-auswertung.md,auswertung.md}`, `referat/evidenz/abbildungen/2c/quellentreue-fehler.*`, `index.md` | Skript geschrieben und ausgeführt; Befundtext entworfen | ✓ |
| 5.4 (Rubrik 2C) | 2C | **Rubrik K1–K5 auf LLM-Ausgaben, Fall P = 200**, Vergleich mit 2A | `referat/evidenz/2c/rubrik-2c.md` | **KI-Entwurf (Claude), von Antonius Richter geprüft und freigegeben**; Zeilenbezüge und 2A-Werte von der KI gegen CSV und `rubrik.md` geprüft | ✓ |
| 6.1 | 2A/2B/2C | Abbildungen (PNG 300 dpi, SVG, `index.md`) | `referat/abbildungen/svg.ts`, `referat/{2a,2b,2c}/abbildungen.ts`, `referat/evidenz/abbildungen/{2a,2b,2c}/` | Skripte geschrieben, Abbildungen erzeugt und auf Überlappungen geprüft | ✓ |
| 6.2 | gemeinsam | Diese Offenlegung | `referat/evidenz/ki-offenlegung.md` | Entwurf aus Protokoll und Git-Historie | ✓ |
| 7 (Handout 2C) | 2C | **Handout 2C** (Text, Abbildungen, Belegliste) | außerhalb des Repos: `Cloud_Computing/handout-2c/`; Skripte `referat/2c/handout/` | **Entwurf von Claude Code (Claude Opus 5.5), von Antonius Richter geprüft und überarbeitet** | ✓ |

## Von der KI entworfene Bewertungs- und Interpretationstexte

Diese Texte gehen über Code und Messung hinaus und sind in der Prüfung als KI-Entwurf anzugeben.

| Inhalt | Datei | Geprüft von | Stand |
| ------ | ----- | ----------- | ----- |
| Beispielbewertungen der Rubrik (3 Varianten × 5 Kriterien, Bemerkungen) | `referat/evidenz/rubrik.md` | Florian Meyer | ✓ |
| Begründungen der 10 auffälligsten Kaskaden-Fehler, drei Fehlermuster | `referat/evidenz/2b/eval/ergebnis.md` | Jeremy Richter | ✓ |
| Einordnung der 10 Sensitivitäts-IDs (Termin, Hilfsmittel, Prüfungsrelevanz, Grenzfall) | `referat/evidenz/2b/eval/ergebnis.md` | Jeremy Richter | ✓ |
| Entscheidung 8.9b mit Voraussetzungen, Betriebsfolge, Grenzen | `referat/evidenz/2b/entscheidung.md` | Jeremy Richter | ✓ |
| Bewertung des Quellentreue-Bogens (Fehlerklassen, `anliegen_fehlt` je Ausgabe, Bemerkungen) | `referat/evidenz/2c/quellentreue-bogen-kompakt.csv` | Antonius Richter | ✓ |
| Rubrikbewertung 2C (3 LLM-Ausgaben × 5 Kriterien, Bemerkungen) | `referat/evidenz/2c/rubrik-2c.md` | Antonius Richter | ✓ |
| Befund 6 (Quellentreue) | `referat/evidenz/2c/auswertung.md` | Antonius Richter | ✓ |
| Titel und Untertitel der Abbildungen (Kernaussage je Abbildung) | `referat/evidenz/abbildungen/*/` (SVG/PNG) | Antonius Richter | ✓ |
| Handout 2C (gesamter Text, Entscheidung, Gruppensynthese, Abbildungen) | `Cloud_Computing/handout-2c/handout-2c.{md,docx,pdf}` (außerhalb des Repos) | Antonius Richter | ✓ |
