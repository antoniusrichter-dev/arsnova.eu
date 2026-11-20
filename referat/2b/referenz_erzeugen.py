# Referat Thema 2 / Auftrag 2B, Schritt 4.1 – erzeugt referat/2b/referenz.csv (Labelspalte leer)
# und prüft gegen apps/backend/src/lib/qaNlpSeed.ts. Aufruf aus dem Repo-Root: python3 -I referat/2b/referenz_erzeugen.py
# Überschreibschutz: bricht ab, wenn referat/2b/referenz.csv bereits existiert (enthält vergebene Labels);
# Neuerzeugung nur mit ausdrücklichem --force.
import csv, json, os, re, sys, difflib, unicodedata
if os.path.exists('referat/2b/referenz.csv') and '--force' not in sys.argv[1:]:
    sys.exit('Abbruch: referat/2b/referenz.csv existiert bereits (vergebene Labels). Überschreiben nur mit --force.')
rows = []
fx = json.load(open('referat/fixtures/sechs-fragen-szenario.json', encoding='utf8'))
for q in fx['fragen']:
    rows.append((q['text'], 'de', 'fixture'))
data = {
 'de': [
  ('kurz', ['Klausur wann?', 'WLAN geht nicht', 'Folien online?', 'Was ist Varianz?', 'Mikro aus?']),
  ('paraphrase', ['Wird die Vorlesung auch als Video bereitgestellt?', 'Kann man die Aufzeichnung später nochmal ansehen?',
                  'Was unterscheidet Korrelation von Kausalität?', 'Warum folgt aus einem Zusammenhang nicht automatisch eine Ursache?',
                  'Bis zu welchem Datum nehmt ihr das Übungsblatt noch an?', 'Wann ist die Deadline für Blatt 3?',
                  'Die Seite lädt bei mir nicht, liegt das am Server?']),
  ('tippfehler', ['Wie berechent man den Standradfehler?', 'Gibts die Folein auch als PDF?',
                  'Mein Bildschrim bleibt schwarz, wenn ich den Link öffne', 'Zält die Hausübung zur Endnote?',
                  'Wie interpretiert man einen kleinen p-Wert richitg?']),
  ('slang', ['Check ich nicht, wieso ist das Intervall so breit?', 'Mega Lag gerade, bin ich der Einzige?',
             'Kommt das Zeug echt alles dran?', 'Läuft die App auch aufm Handy oder nur am Laptop?',
             'Bro, was war nochmal die Formel für die Steigung?']),
  ('mehrdeutig', ['Können wir das nochmal machen?', 'Gibt es dafür noch einen anderen Weg?', 'Ist das wichtig?',
                  'Warum klappt die Abgabe im Portal nicht, obwohl ich die Aufgabe richtig gerechnet habe?',
                  'Gibt es zu Kapitel 5 noch Material?', 'Kann man die Übungsaufgaben auch in R statt Python lösen?',
                  'Wie viel Zeit sollten wir für die Hausaufgabe einplanen?',
                  'Brauchen wir für die Klausur einen Taschenrechner, und welcher ist erlaubt?']),
 ],
 'en': [
  ('kurz', ['Exam date?', 'Sound is gone', 'Slides uploaded?', 'What is a residual?', 'Break soon?']),
  ('paraphrase', ['Will the recording be available after class?', "Can we rewatch today's session later?",
                  'What is the difference between mean and median?', 'Why is the median more robust than the mean?',
                  'Is the deadline for the project still Friday?', 'When exactly is the project due?']),
  ('tippfehler', ['How do I interpert the confidence intervall?', "The link to the quizz doesn't open on my phone",
                  'Is attendence mandatory for the lab sessions?', 'Can you explian the null hypothesis again?']),
  ('slang', ['lowkey lost on the last slide, can you go over it?', 'is the exam gonna be brutal or chill?',
             'app keeps crashing ngl', 'tbh no clue what a z-score is']),
  ('mehrdeutig', ['Could you scroll up a bit?', 'Is this going to be relevant?', "Why doesn't my code give the same result as on the slide?",
                  'Do we need to know the derivation?', 'Can you upload this?']),
 ],
 'fr': [
  ('kurz', ["Quand est l'examen ?", 'Le son ne marche pas']),
  ('paraphrase', ['Est-ce que la séance sera enregistrée ?', 'Pourrait-on revoir la vidéo du cours plus tard ?',
                  "Comment obtient-on l'écart-type à partir des données ?", 'Pourquoi divise-t-on par n-1 pour la variance ?']),
  ('tippfehler', ["Je n'arrive pas a me connecter a la plateform"]),
  ('slang', ["C'est quoi la diff entre régression et corrélation, j'ai rien capté"]),
  ('mehrdeutig', ["Est-ce que c'est important pour la suite ?", 'Le devoir compte combien dans la note finale ?']),
 ],
 'es': [
  ('kurz', ['¿Cuándo es el examen?', 'No se oye nada']),
  ('paraphrase', ['¿Se va a grabar la clase?', '¿Podemos ver la grabación después?',
                  '¿Qué significa un intervalo de confianza del 95 %?', '¿Cómo se interpreta el coeficiente de determinación?']),
  ('tippfehler', ['La aplicasion no me carga en el movil']),
  ('slang', ['Ni idea de lo que es un p-valor, ¿lo explicas otra vez?']),
  ('mehrdeutig', ['¿Esto entra?', '¿Hay que venir obligatoriamente a las prácticas?']),
 ],
}
for lang, groups in data.items():
    for g, texts in groups:
        for t in texts: rows.append((t, lang, g))
assert len(rows) == 80, len(rows)
texts = [r[0] for r in rows]
assert len(set(texts)) == 80
# Abgleich gegen qaNlpSeed.ts
src = open('apps/backend/src/lib/qaNlpSeed.ts', encoding='utf8').read()
seed = re.findall(r"text:\s*(['\"`])((?:\\.|(?!\1).)*)\1", src)
seed = [s[1].replace("\\'", "'") for s in seed]
norm = lambda s: re.sub(r'[^\w]+', ' ', unicodedata.normalize('NFKC', s).lower()).strip()
seedn = [norm(s) for s in seed]
treffer = []
for t in texts:
    n = norm(t)
    best = max(seedn, key=lambda s: difflib.SequenceMatcher(None, n, s).ratio())
    r = difflib.SequenceMatcher(None, n, best).ratio()
    if n in seedn or r >= 0.75: treffer.append((t, round(r, 2), seed[seedn.index(best)]))
print('Seed-Texte:', len(seed), '| exakt/nahe (>=0.8):', treffer)
top = sorted(((round(max(difflib.SequenceMatcher(None, norm(t), s).ratio() for s in seedn), 2), t) for t in texts), reverse=True)[:5]
print('höchste Ähnlichkeit:', top)
with open('referat/2b/referenz.csv', 'w', encoding='utf8', newline='') as f:
    w = csv.writer(f, lineterminator='\n')
    w.writerow(['id', 'text', 'sprache', 'gruppe', 'label_person1'])
    for i, (t, l, g) in enumerate(rows, 1):
        w.writerow([f'R{i:03d}', t, l, g, ''])
from collections import Counter
print(Counter(r[1] for r in rows), Counter(r[2] for r in rows))
json.dump({'seedTexte': len(seed), 'naheTreffer': treffer, 'top5': top}, open('referat/evidenz/2b/seed-abgleich.json','w'), ensure_ascii=False, indent=1)
