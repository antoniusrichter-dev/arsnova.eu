# 2A · Gegenfälle zum Regelkern (Schritt 3.2)

- Erzeugt: 2026-11-20T13:20:11.557Z
- Produktcode = Referenz-Commit `efd71b44`; Harness `referat/2a/gegenfaelle.test.ts` (Erwartungen dort als Kopfkommentar, vor der Ausführung notiert)
- Aufruf: `npx vitest run --config referat/2a/vitest.config.ts gegenfaelle`
- Basis: Sechs-Fragen-Szenario, P = 50 (T = 5); Fall 0 = Baseline aus 3.1
- Fall 5a ruft die echte Freigabeprüfung `collectReleasedQuizSignals` (apps/backend/src/lib/moderationTeachingSignals.ts) auf; ohne COMPLETED-Eintrag erfolgt kein DB-Zugriff (tx ist ein werfender Proxy).

| Fall | Beschreibung | Erwartung (Reibung · Klärung · nächster Schritt) | Ist (Reibung · Klärung · nächster Schritt) | Ergebnis |
| ---- | ------------ | ------------------------------------------------ | ------------------------------------------ | -------- |
| 0 | Baseline (alle ACTIVE) | E, F, A · — · controversy (attach=false) | E, F, A · — · controversy (attach=false) | ✅ wie erwartet |
| 1 | E mit Status PENDING | F, A · E · pending-qa (attach=true) | F, A · E · pending-qa (attach=true) | ✅ wie erwartet |
| 2a | F ARCHIVED, A DELETED – Releasepfad (Kandidatenfilter PENDING/ACTIVE/PINNED) | E · — · controversy (attach=false) | E · — · controversy (attach=false) | ✅ wie erwartet |
| 2b | F ARCHIVED, A DELETED – Regelfunktionen ohne vorgelagerten Filter | E · — · controversy (attach=false) | E · — · controversy (attach=false) | ✅ wie erwartet |
| 3 | G ohne Stimmen (nicht verfügbar) vs. H mit 0/0 | E, F, A · — · controversy (attach=false) | E, F, A · — · controversy (attach=false) | ✅ wie erwartet |
| 4a | Neues Anliegen G „Wird die Vorlesung aufgezeichnet?“ 0/0, ACTIVE | E, F, A · — · controversy (attach=false) | E, F, A · — · controversy (attach=false) | ✅ wie erwartet |
| 4b | Neues Anliegen G 0/0, PENDING (Default qaModerationMode = true) | E, F, A · G · pending-qa (attach=true) | E, F, A · G · pending-qa (attach=true) | ✅ wie erwartet |
| 5a | Quizfrage nur OPENED (nicht freigegeben) → collectReleasedQuizSignals | E, F, A · — · controversy (attach=false) | E, F, A · — · controversy (attach=false) | ✅ wie erwartet |
| 5b | Quizfakt (nicht freigegeben) direkt an planModerationCompass | E, F, A · quiz-result:quiz-question.99999999-9999-4999-8999-999999999999:fact.0 · quiz-confusion (attach=true) | E, F, A · quiz-result:quiz-question.99999999-9999-4999-8999-999999999999:fact.0 · quiz-confusion (attach=true) | ✅ wie erwartet |

## Details je Fall

### Fall 0 – Baseline (alle ACTIVE)

- Karten: friction/caution [E, F, A]
- Badges: A=controversial, B=onesided, C=onesided, D=onesided, E=controversial, F=controversial
- Ergebnis: wie erwartet

### Fall 1 – E mit Status PENDING

- Karten: friction/caution [F, A]; clarification/caution [E] ⇒ pending-qa
- Badges: A=controversial, B=onesided, C=onesided, D=onesided, E=controversial (PENDING), F=controversial
- Ergebnis: wie erwartet

### Fall 2a – F ARCHIVED, A DELETED – Releasepfad (Kandidatenfilter PENDING/ACTIVE/PINNED)

- Karten: friction/caution [E]
- Badges: B=onesided, C=onesided, D=onesided, E=controversial
- Ergebnis: wie erwartet

### Fall 2b – F ARCHIVED, A DELETED – Regelfunktionen ohne vorgelagerten Filter

- Karten: friction/caution [E]
- Badges: A=controversial (DELETED), B=onesided, C=onesided, D=onesided, E=controversial, F=controversial (ARCHIVED)
- Ergebnis: wie erwartet

### Fall 3 – G ohne Stimmen (nicht verfügbar) vs. H mit 0/0

- Karten: friction/caution [E, F, A]
- Badges: A=controversial, B=onesided, C=onesided, D=onesided, E=controversial, F=controversial, G=insufficient, H=insufficient
- Zusatz erwartet: `{"G":{"K":0,"total":0,"badge":"insufficient","inKarte":false},"H":{"K":0,"total":0,"badge":"insufficient","inKarte":false},"ununterscheidbar":true}`
- Zusatz ist: `{"G":{"K":0,"total":0,"badge":"insufficient","inKarte":false},"H":{"K":0,"total":0,"badge":"insufficient","inKarte":false},"ununterscheidbar":true}`
- Notiz: Auf Regelebene ist g.votesAvailable=false vs. h.votesAvailable=true nur im Harness sichtbar; die Produktfunktionen erhalten für beide dieselben Werte.
- Ergebnis: wie erwartet

### Fall 4a – Neues Anliegen G „Wird die Vorlesung aufgezeichnet?“ 0/0, ACTIVE

- Karten: friction/caution [E, F, A]
- Badges: A=controversial, B=onesided, C=onesided, D=onesided, E=controversial, F=controversial, G=insufficient
- Zusatz erwartet: `{"gInKarte":false}`
- Zusatz ist: `{"gInKarte":false}`
- Ergebnis: wie erwartet

### Fall 4b – Neues Anliegen G 0/0, PENDING (Default qaModerationMode = true)

- Karten: friction/caution [E, F, A]; clarification/caution [G] ⇒ pending-qa
- Badges: A=controversial, B=onesided, C=onesided, D=onesided, E=controversial, F=controversial, G=insufficient (PENDING)
- Ergebnis: wie erwartet

### Fall 5a – Quizfrage nur OPENED (nicht freigegeben) → collectReleasedQuizSignals

- Karten: friction/caution [E, F, A]
- Badges: A=controversial, B=onesided, C=onesided, D=onesided, E=controversial, F=controversial
- Zusatz erwartet: `{"releasedState":"not-released","insights":0,"limitationCodes":["not-released"]}`
- Zusatz ist: `{"releasedState":"not-released","insights":0,"limitationCodes":["not-released"]}`
- Ergebnis: wie erwartet

### Fall 5b – Quizfakt (nicht freigegeben) direkt an planModerationCompass

- Karten: friction/caution [E, F, A]; clarification/caution [quiz-result:quiz-question.99999999-9999-4999-8999-999999999999:fact.0] ⇒ quiz-confusion
- Badges: A=controversial, B=onesided, C=onesided, D=onesided, E=controversial, F=controversial
- Zusatz erwartet: `{"factTypes":["wrong-majority"]}`
- Zusatz ist: `{"factTypes":["wrong-majority"]}`
- Notiz: Synthetische Quellen-ID; Fakttypen auf wrong-majority gefiltert (weitere Fakten wie wrong-option sind für die Aussage unerheblich).
- Ergebnis: wie erwartet
