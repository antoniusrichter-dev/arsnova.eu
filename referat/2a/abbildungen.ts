/**
 * ============================================================================
 * VERSUCHSCODE – KEIN PRODUKTPFAD (Referat Thema 2, Auftrag 2A, Schritt 6.1)
 * ============================================================================
 * Abbildung: Kontroversitätswert K je Frage über die Raumgröße P (Rohdaten aus Schritt 3.1).
 * Eingabe: referat/evidenz/2a/baseline-raumgroessen.json
 * Ausgabe: referat/evidenz/abbildungen/2a/ (PNG 300 dpi, SVG, index.md)
 * Aufruf aus Repo-Root: npx tsx referat/2a/abbildungen.ts
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FARBE, de, kreis, linie, pfad, rahmen, rechteck, skala, speichere, text } from '../abbildungen/svg';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const QUELLE = 'referat/evidenz/2a/baseline-raumgroessen.json';
const OUT = path.join(ROOT, 'referat/evidenz/abbildungen/2a');

interface Frage {
  key: string;
  sourceId: string;
  positive: number;
  negative: number;
  controversyScore: number;
  badge: 'controversial' | 'onesided' | 'insufficient';
}
interface Lauf {
  P: number;
  T: number;
  questions: Frage[];
  frictionQuestionSourceIds: string[];
}
const daten = JSON.parse(readFileSync(path.join(ROOT, QUELLE), 'utf8')) as { runs: Lauf[]; referenzCommit: string; head: string };
const laeufe = [...daten.runs].sort((a, b) => a.P - b.P);
const head = execSync('git rev-parse --short=8 HEAD', { cwd: ROOT }).toString().trim();

const B = 540;
const H = 340;
const L = 64;
const R = B - 120;
const O = 62;
const U = H - 62;
const xP = (p: number) => skala(Math.log10(40), Math.log10(1250), L, R)(Math.log10(p));
const yK = skala(0, 1, U, O);
const SERIEN = [
  { key: 'A', farbe: FARBE.serie[0], name: 'A (80/30)' },
  { key: 'E', farbe: FARBE.serie[1], name: 'E (40/40)' },
  { key: 'F', farbe: FARBE.serie[2], name: 'F (20/20)' },
];

function marker(x: number, y: number, badge: Frage['badge'], farbe: string): string {
  if (badge === 'controversial') return kreis(x, y, 4.5, farbe, FARBE.flaeche, 1.5);
  if (badge === 'onesided') return `<circle cx="${x}" cy="${y}" r="4" fill="${FARBE.flaeche}" stroke="${farbe}" stroke-width="2"/>`;
  return `<g stroke="${farbe}" stroke-width="2" stroke-linecap="round"><line x1="${x - 3.5}" y1="${y - 3.5}" x2="${x + 3.5}" y2="${y + 3.5}"/><line x1="${x - 3.5}" y1="${y + 3.5}" x2="${x + 3.5}" y2="${y - 3.5}"/></g>`;
}

const teile: string[] = [];
// P = 50 ist rechnerisch, aber nicht realisierbar (A hat 110 Stimmen bei 50 TN), siehe baseline-raumgroessen.md
teile.push(rechteck(L, O, xP(110) - L, U - O, '#f3f2ef'));
teile.push(text(L + 4, U - 15, 'P = 50 nur rechnerisch', { groesse: 6.5, farbe: FARBE.text2 }));
teile.push(text(L + 4, U - 6, '(A hat 110 Stimmen)', { groesse: 6.5, farbe: FARBE.text2 }));
for (let k = 0; k <= 10; k += 2) {
  const y = yK(k / 10);
  teile.push(linie(L, y, R, y, FARBE.gitter, 0.5));
  teile.push(text(L - 6, y + 2.5, de(k / 10, 1), { groesse: 7, farbe: FARBE.text2, anker: 'end' }));
}
teile.push(linie(L, yK(0.5), R, yK(0.5), FARBE.text2, 1, '4 3'));
teile.push(linie(L, U, R, U, FARBE.achse, 1));
for (const l of laeufe) {
  const x = xP(l.P);
  teile.push(linie(x, U, x, U + 4, FARBE.achse, 1));
  teile.push(text(x, U + 14, `P = ${de(l.P)}`, { groesse: 7.5, anker: 'middle' }));
  teile.push(text(x, U + 24, `T = ${de(l.T)}`, { groesse: 7, anker: 'middle', farbe: FARBE.text2 }));
}
teile.push(text(L + (R - L) / 2, U + 38, 'Raumgröße P (log. Achse) · Mindeststimmen T = max(1, ⌈0,1·P⌉)', { groesse: 7.5, anker: 'middle', farbe: FARBE.text2 }));
teile.push(text(18, O + (U - O) / 2, 'K = 2·min(U,D) / (U+D+T)', { groesse: 7.5, anker: 'middle', farbe: FARBE.text2, drehen: -90 }));

for (const s of SERIEN) {
  const pkt = laeufe.map((l) => {
    const f = l.questions.find((q) => q.key === s.key)!;
    return { x: xP(l.P), y: yK(f.controversyScore), f };
  });
  teile.push(pfad(pkt.map((p) => [p.x, p.y]), s.farbe, 2));
}
for (const s of SERIEN) {
  for (const l of laeufe) {
    const f = l.questions.find((q) => q.key === s.key)!;
    teile.push(marker(xP(l.P), yK(f.controversyScore), f.badge, s.farbe));
  }
}
// Direktbeschriftung links (P = 50) – E und F liegen nah beieinander, daher seitlich gestaffelt
const p50 = laeufe[0]!;
const off: Record<string, number> = { A: 0, E: -3, F: 6 };
for (const s of SERIEN) {
  const f = p50.questions.find((q) => q.key === s.key)!;
  teile.push(text(xP(p50.P) - 9, yK(f.controversyScore) + 2.5 + off[s.key]!, s.key, { groesse: 8, fett: true, anker: 'end' }));
}
const p1000 = laeufe[laeufe.length - 1]!;
const kA = p1000.questions.find((q) => q.key === 'A')!.controversyScore;
const kF = p1000.questions.find((q) => q.key === 'F')!.controversyScore;
if (Math.abs(kA - kF) < 1e-9) {
  teile.push(text(xP(p1000.P) + 8, yK(kA) + 12, `A und F deckungsgleich (${de(kA, 2)})`, { groesse: 6.5, farbe: FARBE.text2 }));
}

// Legende
const lx = R + 4;
let ly = O + 4;
teile.push(text(lx, ly, 'Frage (U/D)', { groesse: 7, fett: true }));
for (const s of SERIEN) {
  ly += 12;
  teile.push(linie(lx, ly - 2.5, lx + 14, ly - 2.5, s.farbe, 2));
  teile.push(text(lx + 18, ly, s.name, { groesse: 7 }));
}
ly += 18;
teile.push(text(lx, ly, 'Badge im Produkt', { groesse: 7, fett: true }));
for (const [b, name] of [
  ['controversial', 'umstritten'],
  ['onesided', 'einseitig'],
  ['insufficient', 'zu wenig Stimmen'],
] as const) {
  ly += 12;
  teile.push(marker(lx + 7, ly - 2.5, b, FARBE.text2));
  teile.push(text(lx + 18, ly, name, { groesse: 7 }));
}
ly += 14;
teile.push(linie(lx, ly - 2.5, lx + 14, ly - 2.5, FARBE.text2, 1, '4 3'));
teile.push(text(lx + 18, ly, 'K = 0,5', { groesse: 7 }));
teile.push(text(lx + 18, ly + 9, '(umstritten: K > 0,5', { groesse: 6.5, farbe: FARBE.text2 }));
teile.push(text(lx + 18, ly + 18, 'und U+D ≥ T)', { groesse: 6.5, farbe: FARBE.text2 }));
ly += 36;
teile.push(text(lx, ly, 'B, C, D: K = 0', { groesse: 6.5, farbe: FARBE.text2 }));
teile.push(text(lx, ly + 9, '(keine Gegenstimmen)', { groesse: 6.5, farbe: FARBE.text2 }));

const svg = rahmen(
  B,
  H,
  '2A · Kontroversität K je Frage über die Raumgröße',
  'Bei gleichen Stimmen verlieren A und später E und F das Signal, weil T mit P wächst.',
  `Quelle: ${QUELLE} (Schritt 3.1) · Regelkern moderation-compass-rules-v1 · Produktcode ${daten.referenzCommit.slice(0, 8)} · erzeugt auf ${head}`,
  teile.join('\n'),
);

async function main(): Promise<void> {
const datei = 'k-werte-raumgroessen.png';
const groesse = await speichere(svg, path.join(OUT, datei));

const tab = [
  '| P | T | ' + ['A', 'B', 'C', 'D', 'E', 'F'].map((k) => `K(${k}) · Badge`).join(' | ') + ' | Karte friction |',
  '| -: | -: |' + ' ---- |'.repeat(6) + ' ---- |',
  ...laeufe.map((l) => {
    const zellen = ['A', 'B', 'C', 'D', 'E', 'F'].map((k) => {
      const f = l.questions.find((q) => q.key === k)!;
      return `${de(f.controversyScore, 4)} · ${f.badge}`;
    });
    const fr = l.frictionQuestionSourceIds.map((id) => l.questions.find((q) => q.sourceId === id)?.key ?? id);
    return `| ${l.P} | ${l.T} | ${zellen.join(' | ')} | ${fr.join(', ') || '–'} |`;
  }),
];
writeFileSync(
  path.join(OUT, 'index.md'),
  `# Abbildungen 2A

Erzeugt mit \`npx tsx referat/2a/abbildungen.ts\` · Arbeitsstand \`${head}\` · Produktcode 1.3.0 \`${daten.referenzCommit.slice(0, 8)}\` · Rohdaten erzeugt auf \`${daten.head.slice(0, 8)}\` · PNG 300 dpi, SVG daneben als Quelle.

## ${datei}

![K-Werte je Raumgröße](${datei})

- **Datenquelle:** \`${QUELLE}\` (Schritt 3.1, echte Regelfunktionen; K nach \`qaRankingSql.ts\`).
- **Darstellung:** K der Fragen A, E, F über P = 50/200/500/1000 (log. Achse). B, C, D haben keine Gegenstimmen und daher K = 0 bei jedem P; sie sind nicht gezeichnet. Die Markerform zeigt das Badge des Produkts: gefüllt = umstritten, Ring = einseitig, Kreuz = zu wenig Stimmen (U+D < T).
- **P = 50** ist grau hinterlegt: rechnerisch, aber nicht realisierbar (A hat 110 Stimmen bei 50 Teilnehmenden). Der realisierbare Fall „P50-skaliert“ steht in \`referat/evidenz/2a/p50-skaliert.md\` und ist hier nicht eingezeichnet.
- Bei P = 1000 liegen A und F mit K = ${de(kA, 4)} genau übereinander.
- Abweichung zum Plan (§0.2): K(A) bei P = 1000 im Plan 0,27, gemessen 0,29 (exakt 0,285714).

Datentabelle (Werte der Abbildung):

${tab.join('\n')}

Pixelmaß: ${groesse.breite} × ${groesse.hoehe}.
`,
);
console.log(`ok ${datei} ${groesse.breite}x${groesse.hoehe}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
