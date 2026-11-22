# Rubrik 2C – LLM-Ausgaben, Fall P = 200

> Rubrik aus `referat/evidenz/rubrik.md` (K1–K5, je 0–2 Punkte, Summe 0–10), angewendet auf die LLM-Ausgaben, Fall P = 200.
> **Bewertung: KI-Entwurf (Claude), von Antonius Richter geprüft und freigegeben.**
> **Grenze:** eine bewertende Person, keine Inter-Rater-Übereinstimmung.

K1 = Quellennachvollziehbarkeit · K2 = Korrekte Bedeutung der Bewertungen · K3 = Trennung organisatorischer und fachlicher Anliegen · K4 = Sichtbare Unsicherheit bzw. Lücken · K5 = Informationsumfang.
Zeilenangaben = Dateizeilen von `referat/evidenz/2c/quellentreue-bogen-kompakt.csv` einschließlich Kopfzeile.

## Bewertung 2C

| Variante | Ausgabe (Datei) | K1 | K2 | K3 | K4 | K5 | Summe | Bemerkung |
| -------- | --------------- | -: | -: | -: | -: | -: | ----: | --------- |
| LLM voll (Fall a) | `quellentreue-bogen-kompakt.csv`, Zeilen 2–7 | 1 | 1 | 1 | 0 | 1 | 4 | Streit E/F erkannt, aber „authoritative evidence“ erfunden und C als „neutral“ fehlgedeutet; Regression fehlt ohne Hinweis. Im Produkt nie angezeigt (Gate → Extraktion). |
| LLM voll mit Lernziel (Fall b) | `quellentreue-bogen-kompakt.csv`, Zeilen 13–16 | 1 | 2 | 1 | 0 | 1 | 5 | Streit E/F korrekt, C „beantwortet“ erfunden; Regression nur als Lernziel wiederholt, Übungswunsch fehlt. |
| LLM nur Texte (Fall b) | `quellentreue-bogen-kompakt.csv`, Zeilen 43–48 | 2 | 1 | 2 | 0 | 2 | 7 | Einzige Ausgabe mit allen drei Anliegen, alles belegt; Zufall durch ID-Reihenfolge ohne Stimmen, Streit nicht erkennbar. |

## Vergleich der Summen (0–10)

| Variante | Summe | Quelle |
| -------- | ----: | ------ |
| Regelkern | 5 | 2A, Florian Meyer (`referat/evidenz/rubrik.md`) |
| Extraktion (extraktiver Fallback) | 4 | 2A, Florian Meyer (`referat/evidenz/rubrik.md`) |
| Ungefilterte Fragenliste | 5 | 2A, Florian Meyer (`referat/evidenz/rubrik.md`) |
| LLM voll | 4–5 | 2C (Fall a: 4, Fall b: 5) |
| LLM nur Texte | 7 (nicht reproduzierbar) | 2C (Fall b) |
