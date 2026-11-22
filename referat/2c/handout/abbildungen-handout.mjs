// Versuchscode (Referat 2C, Handout) – kein Produktpfad.
// Erzeugt vier kompakte, graustufentaugliche Abbildungen für das Handout 2C
// direkt aus den Rohdaten unter referat/evidenz/. Aufruf aus dem Repo-Root:
//   node referat/2c/handout/abbildungen-handout.mjs <ausgabeordner>
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

// ---------- SVG-Helfer ----------
const FONT = "font-family='DejaVu Sans, sans-serif'";
const INK = '#1a1a1a', MUTED = '#555', GRID = '#d0d0d0';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const text = (x, y, s, o = {}) =>
  `<text x='${x}' y='${y}' ${FONT} font-size='${o.size ?? 11}' fill='${o.fill ?? INK}' text-anchor='${o.anchor ?? 'start'}' ${o.bold ? "font-weight='bold'" : ''}>${esc(s)}</text>`;
const defs = `<defs>
  <pattern id='hatch' width='6' height='6' patternUnits='userSpaceOnUse' patternTransform='rotate(45)'>
    <rect width='6' height='6' fill='#ffffff'/><line x1='0' y1='0' x2='0' y2='6' stroke='#333' stroke-width='2'/></pattern>
  <pattern id='dots' width='5' height='5' patternUnits='userSpaceOnUse'>
    <rect width='5' height='5' fill='#bdbdbd'/><circle cx='2.5' cy='2.5' r='1' fill='#333'/></pattern>
</defs>`;
async function save(name, w, h, body) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>${defs}<rect width='${w}' height='${h}' fill='#fff'/>${body}</svg>`;
  fs.writeFileSync(path.join(OUT, `${name}.svg`), svg);
  await sharp(Buffer.from(svg), { density: 300 }).png().toFile(path.join(OUT, `${name}.png`));
  console.log('geschrieben', name);
}

// ---------- Abb. 1: Fragen A–F im Kontext ----------
{
  const faelle = [['a-P200', 'a · P = 200'], ['b-P200-lernziel', 'b · P = 200 + Lernziel'], ['c-P50skaliert-lernziel', 'c · P50-skaliert + Lernziel']];
  const varianten = [['voll', 'voll (Baseline)'], ['nur-texte', 'nur Texte'], ['texte-metadaten', 'Texte + Metadaten']];
  const fr = ['A', 'B', 'C', 'D', 'E', 'F'];
  const sub = ['Regr. 80/30', 'Regr. 10/0', 'Kap. 4 30/0', 'Kap. 4 12/0', 'Anw. 40/40', 'Anw. 20/20'];
  const x0 = 150, cw = 52, ch = 18, gap = 3;
  let y = 44, b = '';
  fr.forEach((f, i) => {
    b += text(x0 + i * cw + cw / 2, 18, f, { anchor: 'middle', bold: true, size: 12 });
    b += text(x0 + i * cw + cw / 2, 32, sub[i], { anchor: 'middle', size: 8, fill: MUTED });
  });
  for (const [fk, fl] of faelle) {
    b += text(4, y + 12, fl, { bold: true, size: 10 });
    y += 17;
    for (const [vk, vl] of varianten) {
      const r = runs.find((x) => x.fall === fk && x.variante === vk && x.gueltig === 'true');
      const order = r.fragen_im_kontext.split(' ');
      b += text(x0 - 8, y + 13, vl, { anchor: 'end', size: 10 });
      fr.forEach((f, i) => {
        const pos = order.indexOf(f);
        const x = x0 + i * cw + gap / 2;
        if (pos >= 0) {
          b += `<rect x='${x}' y='${y}' width='${cw - gap}' height='${ch}' rx='3' fill='#333'/>`;
          b += text(x + (cw - gap) / 2, y + 13, `${pos + 1}.`, { anchor: 'middle', fill: '#fff', bold: true, size: 10 });
        } else {
          b += `<rect x='${x}' y='${y}' width='${cw - gap}' height='${ch}' rx='3' fill='#f0f0f0' stroke='#ccc' stroke-width='0.6'/>`;
          b += text(x + (cw - gap) / 2, y + 13, '–', { anchor: 'middle', fill: '#888', size: 10 });
        }
      });
      y += ch + gap;
    }
    y += 6;
  }
  b += text(4, y + 8, 'Dunkel = im Kontext (Zahl = Position im Prompt); hell = erreicht das Modell nicht.', { size: 8.5, fill: MUTED });
  await save('abb1-fragen-im-kontext', 470, y + 16, b);
}

// ---------- Abb. 2: Quellentreue je Variante (gestapelt, gewichtet) ----------
{
  const gruppen = [
    ['Baseline voll (a–d)', (r) => r.modus === 'baseline'],
    ['nur Texte (a–d)', (r) => r.modus === 'ablation' && r.variante === 'nur-texte'],
    ['Texte + Metadaten (a–d, inkl. Wdh.)', (r) => r.modus !== 'baseline' && r.variante.startsWith('texte-metadaten')],
    ['Gate bestanden (alle Varianten)', (r) => r.gate_ok === 'true'],
  ];
  const data = gruppen.map(([label, f]) => {
    let ok = 0, erf = 0, kz = 0;
    for (const r of bogen.filter(f)) {
      const n = Number(r.vorkommen);
      if (r.erfunden === 'ja') erf += n;
      else if (r.kennzahl_verwechselt === 'ja' || r.lernstandsbehauptung === 'ja' || r.pending_als_lernstand === 'ja') kz += n;
      else ok += n;
    }
    return { label, ok, erf, kz, n: ok + erf + kz };
  });
  fs.writeFileSync(path.join(OUT, 'abb2-daten.json'), JSON.stringify(data, null, 2));
  const x0 = 200, W = 300, bh = 20;
  let y = 30, b = '';
  const seg = [['ok', '#e6e6e6', 'fehlerfrei'], ['erf', 'url(#hatch)', 'erfunden (ggf. zusätzlich Kennzahl)'], ['kz', '#333', 'nur Kennzahl verwechselt']];
  // Legende
  let lx = 4;
  for (const [, fill, l] of seg) {
    b += `<rect x='${lx}' y='6' width='14' height='11' fill='${fill}' stroke='#333' stroke-width='0.6'/>`;
    b += text(lx + 18, 15, l, { size: 9.5 });
    lx += 18 + l.length * 5.6 + 14;
  }
  for (const d of data) {
    if (d.label.startsWith('Gate')) { b += `<line x1='4' x2='${x0 + W + 90}' y1='${y - 4}' y2='${y - 4}' stroke='${GRID}'/>`; }
    b += text(x0 - 8, y + 14, d.label, { anchor: 'end', size: 10 });
    let x = x0;
    for (const [k, fill] of seg) {
      const w = (d[k] / d.n) * W;
      if (w > 0) b += `<rect x='${x}' y='${y}' width='${Math.max(w - 1.5, 0.5)}' height='${bh}' fill='${fill}' stroke='#333' stroke-width='0.6'/>`;
      x += w;
    }
    const pct = Math.round((d.ok / d.n) * 100);
    b += text(x0 + W + 6, y + 14, `${pct} % fehlerfrei (n = ${d.n})`, { size: 9.5 });
    y += bh + 10;
  }
  [0, 50, 100].forEach((p) => {
    b += `<line x1='${x0 + (p / 100) * W}' x2='${x0 + (p / 100) * W}' y1='${y - 6}' y2='${y - 2}' stroke='${MUTED}'/>`;
    b += text(x0 + (p / 100) * W, y + 9, `${p} %`, { anchor: 'middle', size: 9, fill: MUTED });
  });
  b += text(4, y + 24, 'Einträge = Aussagen und nächste Schritte, gewichtet mit „vorkommen“. Lernstandsbehauptungen: 0.', { size: 8.5, fill: MUTED });
  await save('abb2-quellentreue', 640, y + 32, b);
}

// ---------- Abb. 3: Rubrik-Summen ----------
{
  const rows = [
    ['Regelkern (2A, Gruppendaten)', 5, '2a'],
    ['Extraktion / Fallback (2A, Gruppendaten)', 4, '2a'],
    ['Ungefilterte Fragenliste (2A, Gruppendaten)', 5, '2a'],
    ['LLM voll, Fall a (2C)', 4, '2c'],
    ['LLM voll, Fall b (2C)', 5, '2c'],
    ['LLM nur Texte, Fall b (2C, Zufallsauswahl)', 7, '2c'],
  ];
  const x0 = 250, W = 230, bh = 16;
  let y = 8, b = '';
  for (const [l, v, g] of rows) {
    b += text(x0 - 8, y + 12, l, { anchor: 'end', size: 10 });
    b += `<rect x='${x0}' y='${y}' width='${(v / 10) * W}' height='${bh}' fill='${g === '2a' ? 'url(#hatch)' : '#444'}' stroke='#333' stroke-width='0.6'/>`;
    b += text(x0 + (v / 10) * W + 5, y + 12, String(v), { size: 10, bold: true });
    y += bh + 6;
  }
  for (let p = 0; p <= 10; p += 2) {
    b += `<line x1='${x0 + (p / 10) * W}' x2='${x0 + (p / 10) * W}' y1='${y - 4}' y2='${y}' stroke='${MUTED}'/>`;
    b += text(x0 + (p / 10) * W, y + 11, String(p), { anchor: 'middle', size: 9, fill: MUTED });
  }
  b += text(x0 + W / 2, y + 24, 'Rubrik-Summe K1–K5 (0–10), Fall P = 200', { anchor: 'middle', size: 9, fill: MUTED });
  await save('abb3-rubrik', 520, y + 30, b);
}

// ---------- Abb. 4: Dauer pro Anfrage, log. Achse ----------
{
  const valid = runs.filter((r) => r.gueltig === 'true');
  const groups = [
    ['LLM Baseline voll (20 Läufe)', valid.filter((r) => r.modus === 'baseline').map((r) => Number(r.gesamt_ms))],
    ['LLM Ablationen (41 Läufe)', valid.filter((r) => r.modus !== 'baseline').map((r) => Number(r.gesamt_ms))],
  ];
  // 2A-Gruppendaten: aufwand.csv (Median je N) und Releasepfad P200 „Zeit bis fertig“ (fallback/ergebnis.md)
  const auf = parseCsv(fs.readFileSync(`${EV}/2a/aufwand.csv`, 'utf8')).filter((r) => r.szenario === 'extraktiv');
  const extr = auf.map((r) => Number(r.median_us) / 1000);
  const lmin = -2, lmax = 3; // 10 µs … 1000 s in ms-Log: 0,01 ms … 1000 s
  const x0 = 290, W = 380;
  const X = (ms) => x0 + ((Math.log10(ms) - lmin) / 7.3) * W; // 0,01 ms … 200 s
  let b = '', y = 16;
  const ticks = [[0.01, '10 µs'], [0.1, '0,1 ms'], [1, '1 ms'], [10, '10 ms'], [100, '0,1 s'], [1000, '1 s'], [10000, '10 s'], [100000, '100 s']];
  const rowsY = [];
  const lines = [
    ['Extraktion, Funktion (2A, Median N = 50/500/2500)', extr, 'sq'],
    ['Extraktion im Releasepfad, P = 200 (2A, 1 Lauf)', [31], 'sq'],
    ...groups.map(([l, v]) => [l, v, 'dot']),
  ];
  for (const [l, vals, kind] of lines) {
    b += text(x0 - 8, y + 9, l, { anchor: 'end', size: 9.5 });
    for (const v of vals) {
      b += kind === 'sq'
        ? `<rect x='${X(v) - 4}' y='${y + 1}' width='8' height='8' fill='url(#hatch)' stroke='#333'/>`
        : `<circle cx='${X(v)}' cy='${y + 5}' r='3.6' fill='#444' fill-opacity='0.45' stroke='#111' stroke-width='0.5'/>`;
    }
    rowsY.push(y);
    y += 20;
  }
  const top = 8, bot = y;
  for (const [t, l] of ticks) {
    b += `<line x1='${X(t)}' x2='${X(t)}' y1='${top}' y2='${bot}' stroke='${GRID}' stroke-width='0.6'/>`;
    b += text(X(t), bot + 11, l, { anchor: 'middle', size: 9, fill: MUTED });
  }
  b += `<line x1='${X(90000)}' x2='${X(90000)}' y1='${top}' y2='${bot}' stroke='#111' stroke-width='1.2' stroke-dasharray='4 3'/>`;
  b += text(X(90000) - 4, top + 2, 'Timeout 90 s', { size: 8.5, anchor: 'end' });
  const all = groups.flatMap(([, v]) => v);
  b += text(4, bot + 26, `Logarithmische Achse. LLM-Läufe: ${(Math.min(...all) / 1000).toFixed(1).replace('.', ',')}–${(Math.max(...all) / 1000).toFixed(1).replace('.', ',')} s (Gesamtdauer je Anfrage, Lauf 1 kalt, Läufe 2–5 mit Prompt-Cache; teils unter Swap).`, { size: 8.5, fill: MUTED });
  await save('abb4-dauer', 690, bot + 34, b);
}
