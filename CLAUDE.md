# CLAUDE.md – Regeln für alle Sitzungen (Referat Thema 2, Gruppe 8)

- Zweck: Versuche für die Referatsprüfung Cloud Computing, Thema 2 (2A/2B/2C), auf Release 1.3.0. Pläne: /mnt/c/Users/anton/Studium/Cloud_Computing/plaene-2a-2b-2c.md
- Produktcode (apps/, libs/) nicht verändern. Eigener Code nur unter `referat/` (Harness, Skripte) und `referat/evidenz/` (Rohdaten, Protokolle).
- Nur Loopback-Ziele (127.0.0.1/localhost). Nie gegen arsnova.eu-Produktion oder öffentliche Hosts testen.
- Keine SaaS-LLMs als Kompass-Modell. Kein Gemini-Helfer (`qa-summary:dev`) als Nachweis.
- Keine Inhalte aus .env, .env.* oder Tokens in Ausgaben, Logs, Protokolle oder Commits übernehmen.
- Jede Messung: Commit-Hash, Flags, Hardware, Datum in referat/evidenz/protokoll.md mitschreiben. Rohdaten als JSON/CSV unter referat/evidenz/<auftrag>/.
- Baseline, Versuchsvariante und Ergebnis immer getrennt ablegen.
- Bei Fehlern: stoppen und berichten, keine Workarounds am Produktcode.
- Commits: Die Gruppe committet alles von meinem Rechner. Jeder Auftrag mit dem jeweiligen Autor: 2C und Gemeinsames mit mir als Autor, 2A und 2B per `--author` mit dem Autor des Auftrags. Keine Co-Authored-By-Zeile. Nicht pushen.
- 2A und 2B bearbeiten andere Gruppenmitglieder. Dateien unter referat/2a/, referat/evidenz/2a/, referat/evidenz/rubrik.md und referat/evidenz/abbildungen/2a/ gehören in 2A-Commits, Dateien unter referat/2b/, referat/evidenz/2b/ und referat/evidenz/abbildungen/2b/ in 2B-Commits – nie in Sammel-Commits mit anderen Aufträgen. Stagen nur einzeln per Pfad, vor jedem Commit `git diff --cached --name-only` zeigen.
