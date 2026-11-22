// Versuchscode (Referat 2C, Handout) – kein Produktpfad.
// Erzeugt vier kompakte Farbabbildungen für das Handout 2C direkt aus den Rohdaten
// unter referat/evidenz/. Aufruf aus dem Repo-Root:
//   node referat/2c/handout/abbildungen-handout.mjs <ausgabeordner>
//
// Farbcodierung (in allen Abbildungen gleich, Okabe-Ito-Töne, farbenblind-tauglich):
//   LLM-Varianten = Blautöne (voll = Navy, Texte + Metadaten = Blau, nur Texte = Himmelblau)
//   Extraktion / Regelkern / Gruppendaten 2A = Grau
//   Fehler = Zinnoberrot (erfunden) bzw. Orange (Kennzahl verwechselt)
// Werte und Beschriftungen stehen direkt an den Marken, damit die Abbildung auch
// ohne Farbe (Graustufendruck) lesbar bleibt.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const OUT = process.argv[2];
if (!OUT) throw new Error('Ausgabeordner fehlt');
fs.mkdirSync(OUT, { recursive: true });
const EV = 'referat/evidenz';

// ---------- CSV ----------
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...data] = rows;
  return data.filter((r) => r.length === head.length).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}
const runs = parseCsv(fs.readFileSync(`${EV}/2c/auswertung.csv`, 'utf8'));
const bogen = parseCsv(fs.readFileSync(`${EV}/2c/quellentreue-bogen-kompakt.csv`, 'utf8'));

// ---------- Palette ----------
const C = {
  voll: '#003F6B', tm: '#0072B2', nt: '#56B4E9', // LLM-Varianten (Blau-Rampe)
  gate: '#4F6D8A',                                // „Gate bestanden, alle Varianten“ (Blaugrau)
  grau: '#8C8C8C', grauHell: '#EDEDED',           // Extraktion / 2A / nicht im Kontext
  erf: '#D55E00', kz: '#E69F00',                  // Fehler
  ink: '#1a1a1a', muted: '#555', grid: '#d6d6d6',
};
const textOn = (fill) => ([C.nt, C.kz, C.grauHell].includes(fill) ? C.ink : '#fff');

// ---------- SVG-Helfer ----------
const FONT = "font-family='DejaVu Sans, sans-serif'";
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const text = (x, y, s, o = {}) =>
  `<text x='${x}' y='${y}' ${FONT} font-size='${o.size ?? 11}' fill='${o.fill ?? C.ink}' text-anchor='${o.anchor ?? 'start'}' ${o.bold ? "font-weight='bold'" : ''}>${esc(s)}</text>`;
const rect = (x, y, w, h, fill, o = {}) =>
  `<rect x='${x}' y='${y}' width='${Math.max(w, 0)}' height='${h}' rx='${o.rx ?? 2}' fill='${fill}' stroke='${o.stroke ?? '#fff'}' stroke-width='${o.sw ?? 1}'/>`;
async function save(name, w, h, body) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'><rect width='${w}' height='${h}' fill='#fff'/>${body}</svg>`;
  fs.writeFileSync(path.join(OUT, `${name}.svg`), svg);
  await sharp(Buffer.from(svg), { density: 300 }).png().toFile(path.join(OUT, `${name}.png`));
  console.log('geschrieben', name);
}
const legend = (items, x, y) => {
  let b = '';
  for (const [fill, label] of items) {
    b += rect(x, y - 9, 12, 11, fill, { stroke: '#666', sw: 0.6, rx: 1.5 });
    b += text(x + 16, y, label, { size: 10.5 });
    x += 16 + label.length * 6.2 + 16;
  }
  return b;
};

// ---------- Abb. 1: Fragen A–F im Kontext ----------
{
  const faelle = [['a-P200', 'a · P = 200'], ['b-P200-lernziel', 'b · P = 200 + Lernziel'], ['c-P50skaliert-lernziel', 'c · P = 50 skaliert + Lernziel']];
  const varianten = [['voll', 'voll (Baseline)', C.voll], ['texte-metadaten', 'Texte + Metadaten', C.tm], ['nur-texte', 'nur Texte', C.nt]];
  const fr = ['A', 'B', 'C', 'D', 'E', 'F'];
  const sub = ['Regression', 'Regression', 'Kapitel 4', 'Kapitel 4', 'Anwesenheit', 'Anwesenheit'];
  const x0 = 175, cw = 66, ch = 18, gap = 3;
  let y = 46, b = '';
  fr.forEach((f, i) => {
    b += text(x0 + i * cw + cw / 2, 16, f, { anchor: 'middle', bold: true, size: 13 });
    b += text(x0 + i * cw + cw / 2, 31, sub[i], { anchor: 'middle', size: 9.5, fill: C.muted });
  });
  for (const [fk, fl] of faelle) {
    b += text(4, y + 12, fl, { bold: true, size: 11 });
    y += 17;
    for (const [vk, vl, fill] of varianten) {
      const r = runs.find((x) => x.fall === fk && x.variante === vk && x.gueltig === 'true');
      const order = r.fragen_im_kontext.split(' ');
      b += text(x0 - 8, y + 13, vl, { anchor: 'end', size: 11 });
      fr.forEach((f, i) => {
        const pos = order.indexOf(f);
        const x = x0 + i * cw + gap / 2;
        if (pos >= 0) {
          b += rect(x, y, cw - gap, ch, fill, { rx: 3, stroke: C.voll, sw: 0.6 });
          b += text(x + (cw - gap) / 2, y + 13, `${pos + 1}.`, { anchor: 'middle', fill: textOn(fill), bold: true, size: 11 });
        } else {
          b += rect(x, y, cw - gap, ch, C.grauHell, { rx: 3, stroke: '#cfcfcf', sw: 0.6 });
          b += text(x + (cw - gap) / 2, y + 13, '–', { anchor: 'middle', fill: '#888', size: 11 });
        }
      });
      y += ch + gap;
    }
    y += 6;
  }
  b += text(4, y + 9, 'Farbige Zelle = Frage steht im Modellkontext (Zahl = Position im Prompt); grau = erreicht das Modell nie.', { size: 9.5, fill: C.muted });
  await save('abb1-fragen-im-kontext', 575, y + 16, b);
}

// ---------- Abb. 2: Quellentreue je Variante (gestapelt, gewichtet) ----------
{
  const gruppen = [
    ['voll (Baseline, a–d)', C.voll, (r) => r.modus === 'baseline'],
    ['Texte + Metadaten (a–d, inkl. Wdh.)', C.tm, (r) => r.modus !== 'baseline' && r.variante.startsWith('texte-metadaten')],
    ['nur Texte (a–d)', C.nt, (r) => r.modus === 'ablation' && r.variante === 'nur-texte'],
    ['Gate bestanden (alle Varianten)', C.gate, (r) => r.gate_ok === 'true'],
  ];
  const data = gruppen.map(([label, fill, f]) => {
    let ok = 0, erf = 0, kz = 0;
    for (const r of bogen.filter(f)) {
      const n = Number(r.vorkommen);
      if (r.erfunden === 'ja') erf += n;
      else if (r.kennzahl_verwechselt === 'ja' || r.lernstandsbehauptung === 'ja' || r.pending_als_lernstand === 'ja') kz += n;
      else ok += n;
    }
    return { label, fill, ok, erf, kz, n: ok + erf + kz };
  });
  fs.writeFileSync(path.join(OUT, 'abb2-daten.json'), JSON.stringify(data.map(({ fill, ...d }) => d), null, 2));
  const x0 = 232, W = 330, bh = 21;
  let y = 30, b = '';
  b += legend([[C.tm, 'fehlerfrei (Farbe = Variante)'], [C.erf, 'erfunden (ggf. + Kennzahl)'], [C.kz, 'nur Kennzahl verwechselt']], 4, 13);
  for (const d of data) {
    if (d.label.startsWith('Gate')) { b += `<line x1='4' x2='${x0 + W + 75}' y1='${y - 5}' y2='${y - 5}' stroke='${C.grid}'/>`; }
    b += text(x0 - 8, y + 15, d.label, { anchor: 'end', size: 11 });
    let x = x0;
    for (const [k, fill] of [['ok', d.fill], ['erf', C.erf], ['kz', C.kz]]) {
      const w = (d[k] / d.n) * W;
      if (w > 0) {
        b += rect(x, y, w, bh, fill, { rx: 0, stroke: '#fff', sw: 1.5 });
        if (w > 22) b += text(x + w / 2, y + 15, String(d[k]), { anchor: 'middle', size: 10.5, bold: true, fill: textOn(fill) });
      }
      x += w;
    }
    b += text(x0 + W + 8, y + 15, `${Math.round((d.ok / d.n) * 100)} % fehlerfrei (n = ${d.n})`, { size: 10.5 });
    y += bh + 9;
  }
  b += text(4, y + 8, 'Zahlen in den Balken = Einträge (Aussagen + nächste Schritte, gewichtet mit „vorkommen“). Lernstandsbehauptungen: 0.', { size: 9.5, fill: C.muted });
  await save('abb2-quellentreue', 730, y + 15, b);
}

// ---------- Abb. 3: Rubrik-Summen ----------
{
  const rows = [
    ['Regelkern (Gruppendaten 2A)', 5, C.grau],
    ['Extraktion / Fallback (Gruppendaten 2A)', 4, C.grau],
    ['Ungefilterte Fragenliste (Gruppendaten 2A)', 5, C.grau],
    ['LLM voll, Fall a (2C)', 4, C.voll],
    ['LLM voll, Fall b (2C)', 5, C.voll],
    ['LLM nur Texte, Fall b (2C, Zufallsauswahl)', 7, C.nt],
  ];
  const x0 = 268, W = 250, bh = 17;
  let y = 6, b = '';
  for (const [l, v, fill] of rows) {
    b += text(x0 - 8, y + 13, l, { anchor: 'end', size: 11 });
    b += rect(x0, y, (v / 10) * W, bh, fill, { rx: 2, stroke: fill === C.nt ? C.tm : fill, sw: 0.6 });
    b += text(x0 + (v / 10) * W + 6, y + 13, `${v} / 10`, { size: 11, bold: true });
    y += bh + 6;
  }
  for (let p = 0; p <= 10; p += 2) {
    b += `<line x1='${x0 + (p / 10) * W}' x2='${x0 + (p / 10) * W}' y1='${y - 3}' y2='${y + 1}' stroke='${C.muted}'/>`;
    b += text(x0 + (p / 10) * W, y + 12, String(p), { anchor: 'middle', size: 9.5, fill: C.muted });
  }
  b += text(x0 + W / 2, y + 25, 'Rubrik-Summe K1–K5 (0–10), P = 200', { anchor: 'middle', size: 9.5, fill: C.muted });
  await save('abb3-rubrik', 575, y + 31, b);
}

// ---------- Abb. 4: Dauer pro Anfrage, log. Achse ----------
{
  const valid = runs.filter((r) => r.gueltig === 'true');
  const ms = (f) => valid.filter(f).map((r) => Number(r.gesamt_ms));
  const auf = parseCsv(fs.readFileSync(`${EV}/2a/aufwand.csv`, 'utf8')).filter((r) => r.szenario === 'extraktiv');
  const lines = [
    ['Extraktion, Funktion (Gruppendaten 2A)', auf.map((r) => Number(r.median_us) / 1000), C.grau, 'sq'],
    ['Extraktion, Releasepfad P = 200 (2A)', [31], C.grau, 'sq'],
    ['LLM voll (Baseline, 20 Läufe)', ms((r) => r.modus === 'baseline'), C.voll, 'dot'],
    ['LLM Texte + Metadaten (21 Läufe)', ms((r) => r.modus !== 'baseline' && r.variante.startsWith('texte-metadaten')), C.tm, 'dot'],
    ['LLM nur Texte (20 Läufe)', ms((r) => r.modus === 'ablation' && r.variante === 'nur-texte'), C.nt, 'dot'],
  ];
  const x0 = 262, W = 400;
  const X = (v) => x0 + ((Math.log10(v) + 2) / 7.3) * W; // 0,01 ms … 200 s
  let b = '', y = 18;
  const top = 8;
  for (const [l, vals, fill, kind] of lines) {
    b += text(x0 - 8, y + 9, l, { anchor: 'end', size: 11 });
    for (const v of vals) {
      b += kind === 'sq'
        ? `<rect x='${X(v) - 4.5}' y='${y + 0.5}' width='9' height='9' fill='${fill}' stroke='#444' stroke-width='0.6'/>`
        : `<circle cx='${X(v)}' cy='${y + 5}' r='4' fill='${fill}' fill-opacity='0.75' stroke='${C.voll}' stroke-width='0.6'/>`;
    }
    const lab = kind === 'sq'
      ? (vals.length > 1 ? `${(Math.min(...vals)).toFixed(2).replace('.', ',')}–${(Math.max(...vals)).toFixed(2).replace('.', ',')} ms` : `${vals[0]} ms`)
      : `${(Math.min(...vals) / 1000).toFixed(1).replace('.', ',')}–${(Math.max(...vals) / 1000).toFixed(1).replace('.', ',')} s`;
    b += kind === 'sq'
      ? text(X(Math.max(...vals)) + 9, y + 9, lab, { size: 10 })
      : text(X(Math.min(...vals)) - 9, y + 9, lab, { size: 10, anchor: 'end' });
    y += 19;
  }
  const bot = y;
  for (const [t, l] of [[0.01, '10 µs'], [0.1, '0,1 ms'], [1, '1 ms'], [10, '10 ms'], [100, '0,1 s'], [1000, '1 s'], [10000, '10 s'], [100000, '100 s']]) {
    b = `<line x1='${X(t)}' x2='${X(t)}' y1='${top}' y2='${bot}' stroke='${C.grid}' stroke-width='0.6'/>` + b;
    b += text(X(t), bot + 12, l, { anchor: 'middle', size: 9.5, fill: C.muted });
  }
  b += `<line x1='${X(90000)}' x2='${X(90000)}' y1='${top}' y2='${bot}' stroke='${C.ink}' stroke-width='1.2' stroke-dasharray='4 3'/>`;
  b += text(X(90000) + 4, top + 4, 'Timeout 90 s', { size: 9.5 });
  b += text(4, bot + 28, 'Logarithmische Achse. LLM: Gesamtdauer je Anfrage (Lauf 1 kalt, Läufe 2–5 mit Prompt-Cache, teils unter Swap).', { size: 9.5, fill: C.muted });
  await save('abb4-dauer', 735, bot + 35, b);
}
