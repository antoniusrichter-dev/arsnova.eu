// Versuchscode (Referat 2C, Handout) – kein Produktpfad.
// Rendert handout-2c.md -> handout-2c.html (für den PDF-Druck) und _word.html (für Word),
// zählt Wörter im Fließtext sowie die Seiten eines vorhandenen handout-2c.pdf.
// Aufruf aus dem Repo-Root:
//   node referat/2c/handout/render-handout.mjs <ordner-mit-handout-2c.md>
//
// Gestaltung: Fließtext 12 pt Calibri, Zeilenabstand 1,15, Ränder 2 cm. Akzentfarben wie in
// den Abbildungen (Okabe-Ito): Blau = Hauptfarbe, Zinnoberrot = kritisch, Grau = Nebensache.
import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';
import { PDFDocument } from 'pdf-lib';

const DIR = process.argv[2];
const src = fs.readFileSync(path.join(DIR, 'handout-2c.md'), 'utf8').replace(/^---\n[\s\S]*?\n---\n/, '');

// ---- Wortzahl Fließtext: ab Abschnitt 1 bis vor die Literatur, ohne Überschriften,
// Tabellen, Abbildungen, Bild-/Tabellenunterschriften, HTML-Tags, Kopf und Anhang.
function wordCount(md) {
  const body = md.split(/^## 10 Literatur/m)[0];
  const afterHead = body.slice(body.indexOf('## 1 Problem'));
  const lines = afterHead.split('\n').filter((l) =>
    !/^\s*#/.test(l) && !/^\s*\|/.test(l) && !/^\s*!\[/.test(l) && !/^\s*\*(Abb|Tab)\./.test(l));
  const text = lines.join(' ').replace(/<[^>]+>/g, ' ')
    .replace(/`[^`]*`/g, (m) => m.replace(/[^\s]+/g, 'x')).replace(/[*_>#]/g, ' ');
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

const BLAU = '#0072B2', BLAU_DUNKEL = '#00507D', BLAU_HELL = '#E3EFF8', STREIFEN = '#F4F8FB', ROT = '#B34700', GRAU = '#555';
const md = src.replace(/!\[([^\]]*)\]\(([^)]+)\)\{width=(\d+)%\}/g,
  (_, alt, s, w) => `<p class="fig"><img src="${s}" alt="${alt}" style="width:${w}%"></p>`);
// Bild- und Tabellenunterschriften (Zeilen „*Abb. …*“ / „*Tab. …*“) als eigene Klasse.
const body = marked.parse(md).replace(/<p><em>((?:Abb|Tab)\.[\s\S]*?)<\/em><\/p>/g, '<p class="cap">$1</p>');

const css = `
@page { size: A4; margin: 20mm 20mm 18mm 20mm;
  @bottom-center { content: 'Handout 2C · Antonius Richter · Gruppe 8 · Seite ' counter(page) ' / ' counter(pages); font-family: Calibri, sans-serif; font-size: 8.5pt; color: ${GRAU}; } }
body { font-family: Calibri, 'Carlito', Arial, sans-serif; font-size: 12pt; line-height: 1.15; color: #1a1a1a; }
h1 { font-size: 16pt; line-height: 1.15; color: ${BLAU_DUNKEL}; margin: 0 0 4pt; }
h2 { font-size: 13.5pt; color: ${BLAU_DUNKEL}; margin: 9pt 0 3pt; padding-bottom: 1pt; border-bottom: 1.2pt solid ${BLAU}; }
p { margin: 2pt 0 4pt; text-align: left; }
ul, ol { margin: 1pt 0 4pt; padding-left: 15pt; } li { margin: 1pt 0; }
code { font-family: Consolas, 'DejaVu Sans Mono', monospace; font-size: 10pt; color: ${BLAU_DUNKEL}; }
.info { background: ${BLAU_HELL}; border-left: 3pt solid ${BLAU}; padding: 3pt 6pt; margin: 4pt 0 2pt; font-size: 10.5pt; }
.merke { background: ${BLAU_HELL}; border-left: 3pt solid ${BLAU_DUNKEL}; padding: 3pt 6pt; margin: 4pt 0; }
table { border-collapse: collapse; width: 100%; margin: 4pt 0 1pt; font-size: 10.5pt; line-height: 1.15; }
th { background: ${BLAU}; color: #fff; text-align: left; padding: 2pt 5pt; border: 0.5pt solid ${BLAU}; }
td { padding: 2pt 5pt; border-bottom: 0.5pt solid #c9d6e2; vertical-align: top; }
tbody tr:nth-child(even) td { background: ${STREIFEN}; }
table { break-inside: avoid; } h2 { break-after: avoid; } td code { white-space: nowrap; }
h2:nth-last-of-type(2) ~ p code { font-size: 8.5pt; }
.ok { color: ${BLAU_DUNKEL}; font-weight: bold; white-space: nowrap; }
.no { color: ${ROT}; font-weight: bold; white-space: nowrap; }
.fig { text-align: center; margin: 4pt 0 0; } .fig img { display: inline-block; }
.cap { font-size: 9.5pt; color: ${GRAU}; line-height: 1.1; margin: 1pt 0 6pt; } .cap code { font-size: 8.5pt; }
h2:nth-last-of-type(2) ~ p { text-align: left; padding-left: 14pt; text-indent: -14pt; font-size: 10pt; margin: 1pt 0 2pt; line-height: 1.1; }
h2:last-of-type ~ p { font-size: 10pt; text-indent: 0; padding-left: 0; }
`;
const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Handout 2C</title><style>${css}</style></head><body>${body}</body></html>`;
fs.writeFileSync(path.join(DIR, 'handout-2c.html'), html);

// Word-Variante: Word versteht weder verschachtelte @page-Regeln noch :has()/:nth-child();
// daher einfaches CSS, Tabellenstreifen und Kopffarbe setzt das Word-Skript.
const wordCss = `body{font-family:Calibri;font-size:12pt;line-height:115%;color:#1a1a1a}
h1{font-family:Calibri;font-size:16pt;color:${BLAU_DUNKEL};margin:0 0 4pt}
h2{font-family:Calibri;font-size:13.5pt;color:${BLAU_DUNKEL};margin:9pt 0 3pt;border-bottom:solid ${BLAU} 1.2pt}
p{margin:2pt 0 4pt} li{margin:0} code{font-family:Consolas;font-size:10pt;color:${BLAU_DUNKEL}}
.info,.merke{background:${BLAU_HELL};border-left:solid ${BLAU} 3pt;padding:3pt 6pt}
.info{font-size:10.5pt}
table{border-collapse:collapse;font-size:10.5pt} th{background:${BLAU};color:#fff;text-align:left;padding:2pt 5pt}
td{padding:2pt 5pt;border-bottom:solid #c9d6e2 .5pt;vertical-align:top}
.ok{color:${BLAU_DUNKEL};font-weight:bold} .no{color:${ROT};font-weight:bold}
.fig{text-align:center;margin:4pt 0 0} .cap{font-size:9.5pt;color:${GRAU}} .cap code{font-size:8.5pt}`;
fs.writeFileSync(path.join(DIR, '_word.html'),
  `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Handout 2C</title><style>${wordCss}</style></head><body>${body}</body></html>`);

const pdfPath = path.join(DIR, 'handout-2c.pdf');
const pages = fs.existsSync(pdfPath) ? (await PDFDocument.load(fs.readFileSync(pdfPath))).getPageCount() : null;
console.log(JSON.stringify({ seiten: pages, woerter_fliesstext: wordCount(src) }));
