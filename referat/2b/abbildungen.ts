/**
 * ============================================================================
 * VERSUCHSCODE – KEIN PRODUKTPFAD (Referat Thema 2, Auftrag 2B, Schritt 6.1)
 * ============================================================================
 * Abbildungen aus Schritt 4.2: (1) Abdeckung vs. Precision (Accuracy auf classified) je Schwelle,
 * (2) Reliability-Diagramm Kaskade und Keyword bei der Default-Schwelle 0,55.
 * Eingabe: referat/evidenz/2b/eval/ergebnis.json
 * Ausgabe: referat/evidenz/abbildungen/2b/ (PNG 300 dpi, SVG, index.md)
 * Aufruf aus Repo-Root: npx tsx referat/2b/abbildungen.ts
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FARBE, de, kreis, linie, pfad, rahmen, rechteck, skala, speichere, text } from '../abbildungen/svg';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const QUELLE = 'referat/evidenz/2b/eval/ergebnis.json';
const OUT = path.join(ROOT, 'referat/evidenz/abbildungen/2b');

interface Bin {
  bin: string;
  n: number;
  classified: number;
  mittlereKonfidenz: number;
  trefferquote: number;
}
interface Variante {
  methode: 'kaskade' | 'keyword';
  schwelle: number;
  n: number;
  classified: number;
  abdeckung: number;
  accuracyClassified: number;
  reliability: { bins: Bin[]; ece: number };
}
const daten = JSON.parse(readFileSync(path.join(ROOT, QUELLE), 'utf8')) as {
  n: number;
  varianten: Record<string, Variante>;
};
const head = execSync('git rev-parse --short=8 HEAD', { cwd: ROOT }).toString().trim();
const METHODEN = [
  { key: 'kaskade', name: 'Kaskade (Gatekeeper + k-NN)', farbe: FARBE.serie[0] },
  { key: 'keyword', name: 'Keyword-Baseline', farbe: FARBE.serie[1] },
] as const;
const SCHWELLEN = [0.45, 0.55, 0.65];
const v = (m: string, s: number) => daten.varianten[`${m}@${s.toFixed(2)}`]!;
const ZIEL_PREC = 0.85;
const ZIEL_ABD = 0.6;

function abbildungSchwellen(): string {
  const B = 520;
  const H = 360;
  const L = 60;
  const R = B - 150;
  const O = 58;
  const U = H - 56;
  const x = skala(0, 1, L, R);
  const y = skala(0, 1, U, O);
  const t: string[] = [];
  t.push(rechteck(x(ZIEL_ABD), y(1), x(1) - x(ZIEL_ABD), y(ZIEL_PREC) - y(1), '#e6f2e6'));
  t.push(text(x(ZIEL_ABD) + 4, y(1) + 10, 'Zielbereich laut Plan', { groesse: 6.5, farbe: FARBE.text2 }));
  t.push(text(x(ZIEL_ABD) + 4, y(1) + 19, 'Precision ≥ 0,85', { groesse: 6.5, farbe: FARBE.text2 }));
  t.push(text(x(ZIEL_ABD) + 4, y(1) + 28, 'bei Abdeckung ≥ 60 %', { groesse: 6.5, farbe: FARBE.text2 }));
  for (let k = 0; k <= 10; k += 2) {
    t.push(linie(L, y(k / 10), R, y(k / 10), FARBE.gitter, 0.5));
    t.push(text(L - 6, y(k / 10) + 2.5, `${k * 10} %`, { groesse: 7, farbe: FARBE.text2, anker: 'end' }));
    t.push(linie(x(k / 10), U, x(k / 10), U + 4, FARBE.achse, 1));
    t.push(text(x(k / 10), U + 13, `${k * 10} %`, { groesse: 7, farbe: FARBE.text2, anker: 'middle' }));
  }
  t.push(linie(L, U, R, U, FARBE.achse, 1));
  t.push(text(L + (R - L) / 2, U + 28, `Abdeckung (Anteil classified an n = ${daten.n})`, { groesse: 7.5, anker: 'middle', farbe: FARBE.text2 }));
  t.push(text(18, O + (U - O) / 2, 'Precision = Accuracy auf classified', { groesse: 7.5, anker: 'middle', farbe: FARBE.text2, drehen: -90 }));

  for (const m of METHODEN) {
    const pkt = SCHWELLEN.map((s) => ({ s, w: v(m.key, s) }));
    t.push(pfad(pkt.map((p) => [x(p.w.abdeckung), y(p.w.accuracyClassified)]), m.farbe, 1.5));
    for (const p of pkt) t.push(kreis(x(p.w.abdeckung), y(p.w.accuracyClassified), 4.5, m.farbe, FARBE.flaeche, 1.5));
    // Schwellenlabels; gleiche Punkte zusammenfassen, nahe Punkte staffeln
    const gruppen = new Map<string, number[]>();
    for (const p of pkt) {
      const k = `${p.w.abdeckung}|${p.w.accuracyClassified}`;
      gruppen.set(k, [...(gruppen.get(k) ?? []), p.s]);
    }
    // Kaskade: drei Punkte dicht beieinander → feste Lage je Schwelle (links / rechts oben / rechts unten)
    const lage: Record<string, { dx: number; dy: number; anker: 'start' | 'end' }> = {
      '0.45': { dx: -8, dy: 2.5, anker: 'end' },
      '0.55': { dx: 8, dy: -4, anker: 'start' },
      '0.65': { dx: 8, dy: 10, anker: 'start' },
    };
    for (const [k, ss] of gruppen) {
      const [ab, acc] = k.split('|').map(Number) as [number, number];
      const label = ss.map((s) => de(s, 2)).join(' = ');
      const l = m.key === 'kaskade' ? lage[ss[0]!.toFixed(2)]! : { dx: 8, dy: 2.5, anker: 'start' as const };
      t.push(text(x(ab) + l.dx, y(acc) + l.dy, `@${label}`, { groesse: 7, anker: l.anker }));
    }
  }
  // Legende
  let ly = O + 4;
  const lx = R + 12;
  t.push(text(lx, ly, 'Methode', { groesse: 7, fett: true }));
  for (const m of METHODEN) {
    ly += 12;
    t.push(linie(lx, ly - 2.5, lx + 14, ly - 2.5, m.farbe, 1.5));
    t.push(kreis(lx + 7, ly - 2.5, 3.5, m.farbe, FARBE.flaeche, 1));
    t.push(text(lx + 18, ly, m.name, { groesse: 7 }));
  }
  ly += 18;
  t.push(text(lx, ly, 'Label am Punkt:', { groesse: 6.5, farbe: FARBE.text2 }));
  t.push(text(lx, ly + 9, 'QA_NLP_MIN_CONFIDENCE', { groesse: 6.5, farbe: FARBE.text2 }));
  ly += 26;
  for (const m of METHODEN) {
    t.push(text(lx, ly, m.key === 'kaskade' ? 'Kaskade' : 'Keyword', { groesse: 7, fett: true }));
    for (const s of SCHWELLEN) {
      ly += 10;
      const w = v(m.key, s);
      t.push(text(lx, ly, `${de(s, 2)}: ${de(w.abdeckung * 100, 1)} % · ${de(w.accuracyClassified * 100, 1)} %`, { groesse: 6.5, farbe: FARBE.text2 }));
    }
    ly += 14;
  }
  return rahmen(
    B,
    H,
    '2B · Abdeckung und Precision je Konfidenzschwelle',
    'Keine Variante erreicht den Zielbereich; die Schwelle verschiebt die Kaskade kaum.',
    `Quelle: ${QUELLE} (Schritt 4.2, n = ${daten.n}, Gold = label_person1) · Produktcode efd71b44 · erzeugt auf ${head}`,
    t.join('\n'),
  );
}

function abbildungReliability(): string {
  const B = 540;
  const H = 330;
  const panelB = 200;
  const O = 70;
  const U = H - 70;
  const t: string[] = [];
  METHODEN.forEach((m, i) => {
    const L = 60 + i * (panelB + 60);
    const R = L + panelB;
    const x = skala(0.3, 1, L, R);
    const y = skala(0, 1, U, O);
    const w = v(m.key, 0.55);
    t.push(text(L, O - 12, `${m.name} @0,55 · ECE ${de(w.reliability.ece, 3)}`, { groesse: 7.5, fett: true }));
    for (let k = 0; k <= 10; k += 2) {
      t.push(linie(L, y(k / 10), R, y(k / 10), FARBE.gitter, 0.5));
      t.push(text(L - 5, y(k / 10) + 2.5, de(k / 10, 1), { groesse: 6.5, farbe: FARBE.text2, anker: 'end' }));
    }
    for (let k = 3; k <= 10; k += 1) {
      t.push(linie(x(k / 10), U, x(k / 10), U + 3, FARBE.achse, 1));
      t.push(text(x(k / 10), U + 12, de(k / 10, 1), { groesse: 6.5, farbe: FARBE.text2, anker: 'middle' }));
    }
    t.push(linie(L, U, R, U, FARBE.achse, 1));
    t.push(linie(x(0.3), y(0.3), x(1), y(1), FARBE.text2, 1, '4 3'));
    t.push(text(L + (R - L) / 2, U + 26, 'mittlere Konfidenz im Bin', { groesse: 7, anker: 'middle', farbe: FARBE.text2 }));
    if (i === 0) t.push(text(20, O + (U - O) / 2, 'Trefferquote (bestes Label)', { groesse: 7, anker: 'middle', farbe: FARBE.text2, drehen: -90 }));
    const bins = w.reliability.bins.filter((b) => b.n > 0);
    t.push(pfad(bins.map((b) => [x(b.mittlereKonfidenz), y(b.trefferquote)]), m.farbe, 1.5));
    for (const b of bins) {
      const r = 3 + Math.sqrt(b.n) * 0.9;
      t.push(kreis(x(b.mittlereKonfidenz), y(b.trefferquote), r, m.farbe, FARBE.flaeche, 1.5));
      // Lage: erste Kandidatenposition, deren Textbox weder Linie noch Diagonale noch andere Punkte schneidet
      const px = x(b.mittlereKonfidenz);
      const py = y(b.trefferquote);
      const s = `n=${b.n}`;
      const tb = s.length * 3.7;
      const kandidaten = [
        { tx: px, ty: py + r + 9, anker: 'middle' as const },
        { tx: px, ty: py - r - 3, anker: 'middle' as const },
        { tx: px + r + 3, ty: py + 2.5, anker: 'start' as const },
        { tx: px - r - 3, ty: py + 2.5, anker: 'end' as const },
        { tx: px + r + 3, ty: py - 3, anker: 'start' as const },
        { tx: px - r - 3, ty: py - 3, anker: 'end' as const },
        { tx: px + r + 2, ty: py + r + 8, anker: 'start' as const },
        { tx: px - r - 2, ty: py + r + 8, anker: 'end' as const },
        { tx: px + r + 2, ty: py - r - 2, anker: 'start' as const },
        { tx: px - r - 2, ty: py - r - 2, anker: 'end' as const },
        { tx: px - r - 14, ty: py - 3, anker: 'end' as const },
        { tx: px + r + 18, ty: py - 3, anker: 'start' as const },
      ];
      // Kein Kandidat frei → Abbruch statt stiller Überlappung (siehe unten)
      const segmente: [number, number, number, number][] = [
        [x(0.3), y(0.3), x(1), y(1)],
        ...bins.slice(1).map((c, k) => [x(bins[k]!.mittlereKonfidenz), y(bins[k]!.trefferquote), x(c.mittlereKonfidenz), y(c.trefferquote)] as [number, number, number, number]),
      ];
      const frei = (k: (typeof kandidaten)[number]) => {
        const x0 = k.anker === 'start' ? k.tx : k.anker === 'end' ? k.tx - tb : k.tx - tb / 2;
        const box = { x0: x0 - 1, x1: x0 + tb + 1, y0: k.ty - 6.5, y1: k.ty + 1.5 };
        if (box.y1 > U - 1) return false;
        const drin = (qx: number, qy: number) => qx >= box.x0 && qx <= box.x1 && qy >= box.y0 && qy <= box.y1;
        for (const [x1, y1, x2, y2] of segmente) for (let u = 0; u <= 1; u += 0.01) if (drin(x1 + (x2 - x1) * u, y1 + (y2 - y1) * u)) return false;
        for (const c of bins) {
          const cr = 3 + Math.sqrt(c.n) * 0.9 + 1;
          const cx = x(c.mittlereKonfidenz);
          const cy = y(c.trefferquote);
          const nx = Math.max(box.x0, Math.min(cx, box.x1));
          const ny = Math.max(box.y0, Math.min(cy, box.y1));
          if ((nx - cx) ** 2 + (ny - cy) ** 2 < cr * cr) return false;
        }
        return true;
      };
      const k = kandidaten.find(frei);
      if (!k) throw new Error(`Kein freier Platz für Label ${s} (${m.key}, Bin ${b.bin})`);
      t.push(text(k.tx, k.ty, s, { groesse: 6.5, anker: k.anker, farbe: FARBE.text2 }));
    }
  });
  t.push(text(60, H - 22, 'Gestrichelt: perfekte Kalibrierung. Punktfläche ∝ n. Alle 80 Fälle, auch uncertain; Bins à 0,1 der Konfidenz.', { groesse: 6.5, farbe: FARBE.text2 }));
  return rahmen(
    B,
    H,
    '2B · Reliability: Konfidenz gegen Trefferquote',
    'Im Bin 0,9–1,0 liegt die Kaskade mit 44 Fällen bei nur 64 % Treffern: hohe Konfidenz, aber nicht verlässlich.',
    `Quelle: ${QUELLE} (Schritt 4.2, Schwelle 0,55) · Produktcode efd71b44 · erzeugt auf ${head}`,
    t.join('\n'),
  );
}

async function main(): Promise<void> {
  const d1 = 'abdeckung-precision-schwellen.png';
  const d2 = 'reliability.png';
  const g1 = await speichere(abbildungSchwellen(), path.join(OUT, d1));
  const g2 = await speichere(abbildungReliability(), path.join(OUT, d2));
  const zeilen1 = METHODEN.flatMap((m) =>
    SCHWELLEN.map((s) => {
      const w = v(m.key, s);
      return `| ${m.key}@${s.toFixed(2)} | ${w.classified}/${w.n} | ${de(w.abdeckung * 100, 1)} % | ${de(w.accuracyClassified * 100, 1)} % |`;
    }),
  );
  const zeilen2 = METHODEN.flatMap((m) =>
    v(m.key, 0.55).reliability.bins.map(
      (b) => `| ${m.key}@0.55 | ${b.bin} | ${b.n} | ${b.classified} | ${de(b.mittlereKonfidenz, 3)} | ${de(b.trefferquote, 3)} |`,
    ),
  );
  writeFileSync(
    path.join(OUT, 'index.md'),
    `# Abbildungen 2B

Erzeugt mit \`npx tsx referat/2b/abbildungen.ts\` · Arbeitsstand \`${head}\` · Produktcode 1.3.0 \`efd71b44\` · PNG 300 dpi, SVG daneben als Quelle.
Datenquelle beider Abbildungen: \`${QUELLE}\` (Schritt 4.2, \`npx tsx referat/2b/eval.ts\`), Referenzmenge \`referat/2b/referenz.csv\` mit n = ${daten.n}, Gold = \`label_person1\` (eine labelnde Person).

## ${d1}

![Abdeckung und Precision je Schwelle](${d1})

- x = Abdeckung (Anteil classified), y = Accuracy auf classified (im Plan „Precision auf classified“). Je Methode drei Punkte für \`QA_NLP_MIN_CONFIDENCE\` = 0,45 / 0,55 / 0,65, in dieser Reihenfolge verbunden.
- Grün hinterlegt: Zielbereich aus dem Plan (Precision ≥ 0,85 bei Abdeckung ≥ 60 %).
- Keyword @0,55 und @0,65 sind identisch und als ein Punkt beschriftet. Die Kaskade wird von 0,45 auf 0,55 *abdeckender* (nicht monoton, siehe \`ergebnis.md\` Beobachtung 4).

| Variante | classified | Abdeckung | Accuracy (classified) |
| -------- | ---------: | --------: | --------------------: |
${zeilen1.join('\n')}

## ${d2}

![Reliability](${d2})

- Zwei Panels mit gleicher Skala: Kaskade und Keyword-Baseline bei der Default-Schwelle 0,55. Je Konfidenz-Bin (Breite 0,1) mittlere Konfidenz gegen Trefferquote des besten Labels, über alle Fälle einschließlich uncertain (wie in \`ergebnis.md\`). Leere Bins sind nicht gezeichnet.
- Punktfläche proportional zu n; die Diagonale ist perfekte Kalibrierung.

| Variante | Bin | n | davon classified | mittlere Konfidenz | Trefferquote |
| -------- | --- | -: | ---------------: | -----------------: | -----------: |
${zeilen2.join('\n')}

Pixelmaße: ${d1} ${g1.breite} × ${g1.hoehe}, ${d2} ${g2.breite} × ${g2.hoehe}.
`,
  );
  console.log(`ok ${d1} ${g1.breite}x${g1.hoehe}, ${d2} ${g2.breite}x${g2.hoehe}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
