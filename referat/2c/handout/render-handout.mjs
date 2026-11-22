// Versuchscode (Referat 2C, Handout) – kein Produktpfad.
// Rendert handout-2c.md -> handout-2c.html (Zwischenstufe für PDF und Word) und zählt
// Wörter im Fließtext sowie die Seiten eines vorhandenen handout-2c.pdf. Aufruf aus dem Repo-Root:
//   node referat/2c/handout/render-handout.mjs <ordner-mit-handout-2c.md>
import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';
import { PDFDocument } from 'pdf-lib';

const DIR = process.argv[2];
const src = fs.readFileSync(path.join(DIR, 'handout-2c.md'), 'utf8').replace(/^---\n[\s\S]*?\n---\n/, '');

// ---- Wortzahl Fließtext: ohne Titel/Kopf, Überschriften, Tabellen, Abbildungen,
// Bild-/Tabellenunterschriften, Literatur und Anhang (KI-Offenlegung).
function wordCount(md) {
  const body = md.split(/^## 10 Literatur/m)[0];
  const afterHead = body.slice(body.indexOf('## 1 Problem'));
  const lines = afterHead.split('\n').filter((l) =>
    !/^\s*#/.test(l) && !/^\s*\|/.test(l) && !/^\s*!\[/.test(l) && !/^\s*\*(Abb|Tab)\./.test(l));
  const text = lines.join(' ').replace(/`[^`]*`/g, (m) => m.replace(/[^\s]+/g, 'x')).replace(/[*_>#]/g, ' ');
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

const md = src.replace(/!\[([^\]]*)\]\(([^)]+)\)\{width=(\d+)%\}/g,
  (_, alt, s, w) => `<p class="fig"><img src="${s}" alt="${alt}" style="width:${w}%"></p>`);
const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Handout 2C</title>
<style>
@page { size: A4; margin: 15mm 16mm 14mm 16mm;
  @bottom-center { content: 'Handout 2C · Antonius Richter · Gruppe 8 · Seite ' counter(page) '/' counter(pages); font-size: 7pt; color: #555; } }
body { font-family: 'DejaVu Sans', Arial, sans-serif; font-size: 8.6pt; line-height: 1.32; color: #111; }
h1 { font-size: 12.5pt; margin: 0 0 3pt; }
h2 { font-size: 10pt; margin: 7pt 0 2pt; border-bottom: 0.5pt solid #999; }
p { margin: 2pt 0 3pt; text-align: justify; hyphens: auto; }
ul, ol { margin: 1pt 0 3pt; padding-left: 14pt; } li { margin: 0.5pt 0; }
ul ul { margin: 0; }
code { font-family: 'DejaVu Sans Mono', monospace; font-size: 7.6pt; }
table { border-collapse: collapse; width: 100%; margin: 3pt 0 1pt; font-size: 8pt; }
th, td { border: 0.5pt solid #888; padding: 1.5pt 4pt; text-align: left; vertical-align: top; }
th { background: #e8e8e8; }
.fig { text-align: center; margin: 3pt 0 0; } .fig img { display: inline-block; }
p > em:only-child { font-size: 7.6pt; color: #333; } p:has(> em:only-child) { text-align: left; }
h2:nth-last-of-type(2) ~ p { text-align: left; padding-left: 14pt; text-indent: -14pt; font-size: 7.8pt; margin: 1pt 0; }
h2:last-of-type ~ ul, h2:last-of-type ~ p { font-size: 7.8pt; }
</style></head><body>${marked.parse(md)}</body></html>`;
const htmlPath = path.join(DIR, 'handout-2c.html');
fs.writeFileSync(htmlPath, html);
// Word-Variante: Word versteht weder verschachtelte @page-Regeln noch :has(); daher einfaches CSS.
const wordCss = `body{font-family:Arial;font-size:8.5pt;line-height:115%} h1{font-size:13pt;margin:0 0 3pt} h2{font-size:10pt;margin:7pt 0 2pt}
p{margin:1pt 0 3pt;text-align:left} li{margin:0} code{font-family:Consolas;font-size:7.8pt} table{border-collapse:collapse;font-size:8pt}
th,td{border:0.5pt solid #888;padding:1pt 3pt;text-align:left;vertical-align:top} th{background:#e8e8e8} .fig{text-align:center;margin:3pt 0 0} em{font-size:7.8pt}`;
fs.writeFileSync(path.join(DIR, '_word.html'), html.replace(/<style>[\s\S]*?<\/style>/, `<style>${wordCss}</style>`));

// PDF: Chromium-Druck des HTML. In diesem Labor fehlen der Linux-Shell die Systembibliotheken,
// daher wird das PDF mit dem Windows-Edge (headless, --print-to-pdf) erzeugt; Seitenzahl hier.
const pdfPath = path.join(DIR, 'handout-2c.pdf');
const pages = fs.existsSync(pdfPath) ? (await PDFDocument.load(fs.readFileSync(pdfPath))).getPageCount() : null;
console.log(JSON.stringify({ seiten: pages, woerter_fliesstext: wordCount(src) }));
