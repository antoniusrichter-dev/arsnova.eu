# Auftrag 2B – Entscheidung (Klassifikation 8.9b)

> **KI-Entwurf (Claude, 21.11.2026), von Jeremy Richter geprüft und freigegeben.** Mit „Vermutung“ markierte Ursachen sind nicht gemessen.
> Datengrundlage: `referat/evidenz/2b/eval/ergebnis.md`, `vorhersagen.csv`, `referat/evidenz/2b/last/ergebnis.md`, `referat/evidenz/2b/kontext.md`, `apps/backend/src/lib/qaNlpSeed.ts` (Produktcode 1.3.0 `efd71b44`).

**Leitfrage:** Liefert die 8.9b-Klassifikation nachweisbar mehr als die lexikalische Baseline, und lohnt sich die Aktivierung?

**Ergebnis gegen die vorab festgelegten Schwellen:**

| Kriterium (Plan) | Schwelle | Gemessen (Kaskade @0,55) | Erfüllt? |
|---|---|---|---|
| Precision auf classified | ≥ 0,85 | 0,68 | nein |
| Abdeckung | ≥ 60 % | 74 % | ja |
| Vorsprung Macro-F1 vor Keyword | ≥ 10 pp | +27 pp (0,571 vs. 0,300) | ja |

**Weitere Befunde:**
- Konfidenz nicht kalibriert (ECE 0,26; im Bereich 0,9–1,0 nur 64 % Treffer).
- Die Schwelle `QA_NLP_MIN_CONFIDENCE` wirkt kaum und nicht monoton. Sie ist als Stellschraube also untauglich.
- Seed-Werte übertragen sich nicht (87 % auf Seed, 68 % auf eigener Menge).
- Last: Die Submit-Latenz bleibt unverändert, der Livebetrieb wird also nicht gestört. Bei 200 gleichzeitigen Fragen bleiben aber mit Limit 100 rund die Hälfte (98) und mit Limit 20 fast alle (179) dauerhaft unklassifiziert (`FAILED`). Die Laufzeitmetrik `unclassifiedRate` zeigt das nicht (0,27 statt real 49 %).
- Kontext #456: Nur gespeicherte Kategorien gehen ein, keine Neuanalyse beim Abruf (live geprüft).

**Entscheidungsvorschlag:**
> 8.9b in Release 1.3 **nicht als automatische Sortierhilfe aktivieren**. Die Kaskade ist zwar deutlich besser als Keywords, verfehlt aber die Präzisionsschwelle. Ihre Fehler treten mit höchster Konfidenz auf und werden daher nicht als „unsicher“ markiert. Höchstens als ausdrücklich unsicheres Zusatzsignal neben dem Regelkern denkbar, nicht als Grundlage für die Lehrperson.
> **Voraussetzungen für eine spätere Aktivierung:** (1) einheitliche Konvention für Prüfungsrelevanz im Repo, (2) Seed um Aufzeichnung/Werkzeuge/FR-ES erweitern, (3) Kalibrierung der Konfidenz, (4) Skip-Verhalten bei Bursts sichtbar machen (Metrik korrigieren, Nachklassifikation).
> **Betriebsfolge:** Deaktiviert kostet nichts. Aktiviert ist der Rechenaufwand vernachlässigbar (p50 2 ms), das Risiko liegt in falsch-sicheren Kategorien und stillen Lücken unter Last.

**Grenzen:**
- Referenzmenge synthetisch, 80 Fragen, von einer Person gelabelt (keine Inter-Rater-Übereinstimmung)
- Labelkonvention zur Prüfungsrelevanz weicht vom Produkt-Seed ab (Sensitivitätsanalyse)
- Lasttest lokal, ein Rechner, nur 200er-Bursts
- Ursachen der Einzelfehler zum Teil nur vermutet
