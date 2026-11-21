# VERSUCHSCODE (Referat 2C, 5.4) – kein Produktpfad.
# Verdichtet referat/evidenz/2c/quellentreue-bogen.csv: identische Aussagen (gleicher Modus,
# Fall, Variante, Art, Text und sourceIds) → eine Zeile mit „vorkommen“ und Lauf-IDs.
# Fehlerklassen bleiben leer. Die Langfassung wird nicht verändert.
# Aufruf aus Repo-Root: python3 referat/2c/bogen-kompakt.py
import csv
from collections import OrderedDict

SRC = 'referat/evidenz/2c/quellentreue-bogen.csv'
DST = 'referat/evidenz/2c/quellentreue-bogen-kompakt.csv'
FEHLER = ['erfunden', 'kennzahl_verwechselt', 'anliegen_fehlt', 'lernstandsbehauptung',
          'pending_als_lernstand', 'bemerkung']

with open(SRC, newline='', encoding='utf-8') as f:
    rows = list(csv.DictReader(f))
groups: 'OrderedDict[tuple, dict]' = OrderedDict()
for r in rows:
    key = (r['modus'], r['fall'], r['variante'], r['art'], r['aussagetext'], r['sourceIds'])
    g = groups.setdefault(key, {'laeufe': [], 'nr': [], 'gate': set()})
    g['laeufe'].append(f"{r['modus']}/{r['fall']}/{r['variante']}/lauf{r['lauf']}")
    g['nr'].append(r['nr'])
    g['gate'].add(r['gate_ok'])
cols = ['modus', 'fall', 'variante', 'art', 'nr', 'gate_ok', 'aussagetext', 'sourceIds',
        'vorkommen', 'lauf_ids', *FEHLER]
with open(DST, 'w', newline='', encoding='utf-8') as f:
    w = csv.writer(f, lineterminator='\n')
    w.writerow(cols)
    for (modus, fall, variante, art, text, ids), g in groups.items():
        w.writerow([modus, fall, variante, art, ' '.join(sorted(set(g['nr']))),
                    ' '.join(sorted(g['gate'])), text, ids, len(g['laeufe']),
                    ' '.join(g['laeufe']), *[''] * len(FEHLER)])
print(f'{len(rows)} Zeilen → {len(groups)} Zeilen ({DST})')
