/**
 * ============================================================================
 * VERSUCHSCODE – KEIN PRODUKTPFAD (Referat Thema 2, Auftrag 2C, Auswertung Quellentreue-Bogen)
 * ============================================================================
 * Wertet den ausgefüllten Bogen referat/evidenz/2c/quellentreue-bogen-kompakt.csv aus
 * (Bewertung: KI-Entwurf von Claude, von Antonius Richter geprüft).
 *
 * Zählweise:
 *   - Jede Zeile steht für `vorkommen` identische Einträge (Aussage oder nächster Schritt) → gewichtet.
 *   - „Fehler“ einer Zeile = mindestens eine der Klassen erfunden, kennzahl_verwechselt,
 *     lernstandsbehauptung, pending_als_lernstand mit „ja“.
 *   - anliegen_fehlt gilt je Ausgabe (ein Wert je Lauf, eingetragen bei statement nr 1);
 *     es zählt nicht als Fehler einer Aussage.
 * Prüft vorab: nur ja/nein (anliegen_fehlt: ja/nein/n/a oder leer), genau ein anliegen_fehlt je Ausgabe.
 * Ausgaben: referat/evidenz/2c/quellentreue-auswertung.md,
 *           referat/evidenz/abbildungen/2c/quellentreue-fehler.{png,svg}
 * Aufruf aus Repo-Root: npx tsx referat/2c/quellentreue.ts
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FARBE, de, linie, rahmen, rechteck, skala, speichere, text } from '../abbildungen/svg';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const EV = 'referat/evidenz/2c';
const QUELLE = `${EV}/quellentreue-bogen-kompakt.csv`;
const OUT = path.join(ROOT, 'referat/evidenz/abbildungen/2c');
const head = execSync('git rev-parse --short=8 HEAD', { cwd: ROOT }).toString().trim();

/** CSV-Parser (RFC 4180 ohne eingebettete Zeilenumbrüche). */
function csv(datei: string): Record<string, string>[] {
  const roh = readFileSync(path.join(ROOT, datei), 'utf8');
  if (roh.includes('\r')) throw new Error(`${datei}: CR gefunden, erwartet LF`);
  const zeilen = roh.split('\n').filter(Boolean);
  const teile = (z: string) => {
    const out: string[] = [];
    let c = '';
    let q = false;
    for (let i = 0; i < z.length; i += 1) {
      const ch = z[i]!;
      if (q) {
        if (ch === '"' && z[i + 1] === '"') {
          c += '"';
          i += 1;
        } else if (ch === '"') q = false;
        else c += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') {
        out.push(c);
        c = '';
      } else c += ch;
    }
    out.push(c);
    return out;
  };
  const kopf = teile(zeilen[0]!);
  return zeilen.slice(1).map((z, i) => {
    const t = teile(z);
    if (t.length !== kopf.length) throw new Error(`${datei} Zeile ${i + 2}: ${t.length} statt ${kopf.length} Felder`);
    return Object.fromEntries(t.map((v, j) => [kopf[j]!, v]));
  });
}

const KLASSEN = ['erfunden', 'kennzahl_verwechselt', 'lernstandsbehauptung', 'pending_als_lernstand'] as const;
const zeilen = csv(QUELLE);

// ---------------------------------------------------------------- Prüfung
for (const [i, r] of zeilen.entries()) {
  for (const k of KLASSEN) if (!['ja', 'nein'].includes(r[k]!)) throw new Error(`Zeile ${i + 2}: ${k} = "${r[k]}"`);
  if (!['ja', 'nein', 'n/a', ''].includes(r.anliegen_fehlt!)) throw new Error(`Zeile ${i + 2}: anliegen_fehlt = "${r.anliegen_fehlt}"`);
  if (r.anliegen_fehlt && !(r.art === 'statement' && r.nr === '1')) throw new Error(`Zeile ${i + 2}: anliegen_fehlt außerhalb statement nr 1`);
  if (!/^[1-9]\d*$/u.test(r.vorkommen!)) throw new Error(`Zeile ${i + 2}: vorkommen = "${r.vorkommen}"`);
  if (!['true', 'false'].includes(r.gate_ok!)) throw new Error(`Zeile ${i + 2}: gate_ok = "${r.gate_ok}"`);
}
function laeufeVon(r: Record<string, string>): string[] {
  const p = `${r.modus}/`;
  const l = ` ${r.lauf_ids}`.split(` ${p}`).map((s) => s.trim()).filter(Boolean).map((s) => p + s);
  if (l.length !== Number(r.vorkommen)) throw new Error(`lauf_ids passt nicht zu vorkommen: ${r.lauf_ids}`);
  return l;
}
const ausgabeAnliegen = new Map<string, string>();
const alleAusgaben = new Set<string>();
for (const r of zeilen) {
  for (const l of laeufeVon(r)) {
    alleAusgaben.add(l);
    if (!r.anliegen_fehlt) continue;
    if (ausgabeAnliegen.has(l)) throw new Error(`anliegen_fehlt doppelt für ${l}`);
    ausgabeAnliegen.set(l, r.anliegen_fehlt);
  }
}
for (const l of alleAusgaben) if (!ausgabeAnliegen.has(l)) throw new Error(`anliegen_fehlt fehlt für ${l}`);
const summeVorkommen = zeilen.reduce((s, r) => s + Number(r.vorkommen), 0);

// ---------------------------------------------------------------- Zählung
interface Zaehler {
  eintraege: number;
  mitFehler: number;
  aussagen: number;
  aussagenMitFehler: number;
  schritte: number;
  schritteMitFehler: number;
  klasse: Record<(typeof KLASSEN)[number], number>;
  ausgaben: number;
  anliegen: Record<'ja' | 'nein' | 'n/a', number>;
  gateOk: number;
}
const neu = (): Zaehler => ({
  eintraege: 0,
  mitFehler: 0,
  aussagen: 0,
  aussagenMitFehler: 0,
  schritte: 0,
  schritteMitFehler: 0,
  klasse: { erfunden: 0, kennzahl_verwechselt: 0, lernstandsbehauptung: 0, pending_als_lernstand: 0 },
  ausgaben: 0,
  anliegen: { ja: 0, nein: 0, 'n/a': 0 },
  gateOk: 0,
});
function zaehle(z: Zaehler, r: Record<string, string>): void {
  const v = Number(r.vorkommen);
  const f = KLASSEN.some((k) => r[k] === 'ja');
  z.eintraege += v;
  if (f) z.mitFehler += v;
  if (r.art === 'statement') {
    z.aussagen += v;
    if (f) z.aussagenMitFehler += v;
  } else {
    z.schritte += v;
    if (f) z.schritteMitFehler += v;
  }
  for (const k of KLASSEN) if (r[k] === 'ja') z.klasse[k] += v;
  if (r.anliegen_fehlt) {
    z.ausgaben += v;
    z.anliegen[r.anliegen_fehlt as 'ja' | 'nein' | 'n/a'] += v;
    if (r.gate_ok === 'true') z.gateOk += v;
  }
}

const FAELLE = [
  { key: 'a-P200', name: 'a · P200' },
  { key: 'b-P200-lernziel', name: 'b · P200 + Lernziel' },
  { key: 'c-P50skaliert-lernziel', name: 'c · P50-skaliert + Lernziel' },
  { key: 'd-456-teilmenge', name: 'd · #456-Teilmenge' },
] as const;
const WDH = 'texte-metadaten (Wdh. nach OOM-Neustart)';
const VARIANTEN = [
  { key: 'voll', name: 'voll (Baseline)' },
  { key: 'nur-texte', name: 'nur Texte' },
  { key: 'texte-metadaten', name: 'Texte + Metadaten' },
  { key: WDH, name: 'Texte + Metadaten, Wdh.' },
] as const;

interface Gruppe {
  fall: (typeof FAELLE)[number];
  variante: (typeof VARIANTEN)[number];
  z: Zaehler;
}
const gruppen: Gruppe[] = [];
for (const fall of FAELLE) {
  for (const variante of VARIANTEN) {
    const rs = zeilen.filter((r) => r.fall === fall.key && r.variante === variante.key);
    if (!rs.length) continue;
    const z = neu();
    rs.forEach((r) => zaehle(z, r));
    gruppen.push({ fall, variante, z });
  }
}
const gezaehlt = gruppen.reduce((s, g) => s + g.z.eintraege, 0);
if (gezaehlt !== summeVorkommen) throw new Error(`Gruppen decken ${gezaehlt} statt ${summeVorkommen} Einträge ab`);

const gesamt = neu();
const angezeigt = neu();
const nichtAngezeigt = neu();
for (const r of zeilen) {
  zaehle(gesamt, r);
  zaehle(r.gate_ok === 'true' ? angezeigt : nichtAngezeigt, r);
}

const pz = (a: number, b: number) => (b ? `${de((100 * a) / b, 0)} %` : '–');
const anl = (z: Zaehler) => (z.anliegen['n/a'] === z.ausgaben ? 'n/a' : `${z.anliegen.ja}/${z.ausgaben - z.anliegen['n/a']}`);

// ---------------------------------------------------------------- Abbildung
function abbildung(): string {
  const B = 640;
  const xLabel = 34;
  const xAusg = 196;
  const L = 214;
  const R = 364;
  const xErf = 430;
  const xKz = 478;
  const xAnl = 532;
  const xGate = 588;
  const zeileH = 15;
  const kopfH = 14;
  const O = 78;
  const x = skala(0, 1, L, R);
  const t: string[] = [];
  // Spaltenköpfe
  const kopf = (xx: number, a: string, b: string, anker: 'start' | 'middle' | 'end' = 'middle') => {
    t.push(text(xx, O - 16, a, { groesse: 6.5, fett: true, anker }));
    t.push(text(xx, O - 8, b, { groesse: 6, farbe: FARBE.text2, anker }));
  };
  kopf(xAusg, 'Ausg.', 'n', 'end');
  kopf(L, 'Einträge mit ≥ 1 Fehler', 'Anteil, gewichtet mit „vorkommen“', 'start');
  kopf(xErf, 'erfunden', 'Einträge');
  kopf(xKz, 'Kennzahl', 'verwechselt');
  kopf(xAnl, 'Anliegen', 'fehlt (Ausg.)');
  kopf(xGate, 'Gate', 'angezeigt');
  let y = O;
  const yStart = O;
  for (const fall of FAELLE) {
    const gs = gruppen.filter((g) => g.fall.key === fall.key);
    y += kopfH;
    t.push(text(24, y - 3, fall.name, { groesse: 7.5, fett: true }));
    for (const g of gs) {
      const ym = y + zeileH / 2;
      const anteil = g.z.mitFehler / g.z.eintraege;
      t.push(text(xLabel, ym + 2.5, g.variante.name, { groesse: 7 }));
      t.push(text(xAusg, ym + 2.5, de(g.z.ausgaben), { groesse: 7, anker: 'end', farbe: FARBE.text2 }));
      t.push(rechteck(L, ym - 4, R - L, 8, '#f3f2ef', 'rx="2"'));
      if (anteil > 0) t.push(rechteck(L, ym - 4, Math.max(x(anteil) - L, 3), 8, FARBE.serie[0], 'rx="2"'));
      t.push(text(R + 6, ym + 2.5, `${pz(g.z.mitFehler, g.z.eintraege)} (${g.z.mitFehler}/${g.z.eintraege})`, { groesse: 7 }));
      t.push(text(xErf, ym + 2.5, de(g.z.klasse.erfunden), { groesse: 7, anker: 'middle' }));
      t.push(text(xKz, ym + 2.5, de(g.z.klasse.kennzahl_verwechselt), { groesse: 7, anker: 'middle' }));
      t.push(text(xAnl, ym + 2.5, anl(g.z), { groesse: 7, anker: 'middle', farbe: anl(g.z) === 'n/a' ? FARBE.text2 : FARBE.text }));
      const ok = g.z.gateOk === g.z.ausgaben;
      const keins = g.z.gateOk === 0;
      t.push(
        text(xGate, ym + 2.5, ok ? `✓ ${g.z.gateOk}/${g.z.ausgaben}` : keins ? `✗ 0/${g.z.ausgaben}` : `${g.z.gateOk}/${g.z.ausgaben}`, {
          groesse: 7,
          anker: 'middle',
          fett: true,
          farbe: ok ? FARBE.gut : FARBE.kritisch,
        }),
      );
      y += zeileH;
    }
  }
  for (const v of [0, 0.5, 1]) t.push(linie(x(v), yStart + 2, x(v), y, FARBE.gitter, 0.5));
  for (const v of [0, 0.5, 1]) t.push(text(x(v), y + 9, `${de(v * 100)} %`, { groesse: 6.5, anker: 'middle', farbe: FARBE.text2 }));
  const yU = y + 24;
  const fuss = [
    `Gesamt: ${gesamt.mitFehler}/${gesamt.eintraege} Einträge (${pz(gesamt.mitFehler, gesamt.eintraege)}) mit ≥ 1 Fehler; Aussagen ${gesamt.aussagenMitFehler}/${gesamt.aussagen}, nächste Schritte ${gesamt.schritteMitFehler}/${gesamt.schritte}. Lernstandsbehauptung und pending als Lernstand: je 0.`,
    `Fehler = erfunden, kennzahl_verwechselt, lernstandsbehauptung oder pending_als_lernstand. „Anliegen fehlt“ gilt je Ausgabe (ja/bewertbar); n/a = Fall d ohne Fixture-Anliegen.`,
    `d · Texte + Metadaten: nur 1 gültige Ausgabe vor dem OOM. Bewertung: KI-Entwurf (Claude), von Antonius Richter geprüft.`,
  ];
  fuss.forEach((s, i) => t.push(text(24, yU + i * 9, s, { groesse: 6, farbe: FARBE.text2 })));
  const H = yU + fuss.length * 9 + 20;
  return rahmen(
    B,
    H,
    '2C · Quellentreue je Fall und Variante (manuelle Bewertung)',
    'Fehler sind fast nur erfundene Details. Was das Gate durchlässt: 0/45 Aussagen fehlerhaft, aber in a fehlt das Anliegen.',
    `Quelle: ${QUELLE} (93 Zeilen, 271 Einträge, 61 Ausgaben) · erzeugt mit referat/2c/quellentreue.ts auf ${head}`,
    t.join('\n'),
  );
}

// ---------------------------------------------------------------- Ausgabe
async function main(): Promise<void> {
  const datei = 'quellentreue-fehler.png';
  const groesse = await speichere(abbildung(), path.join(OUT, datei));
  const tab = gruppen.map((g) => {
    const z = g.z;
    return `| ${g.fall.name} | ${g.variante.name} | ${z.ausgaben} | ${z.gateOk}/${z.ausgaben} | ${z.eintraege} | ${z.mitFehler} (${pz(z.mitFehler, z.eintraege)}) | ${z.aussagenMitFehler}/${z.aussagen} | ${z.schritteMitFehler}/${z.schritte} | ${z.klasse.erfunden} | ${z.klasse.kennzahl_verwechselt} | ${z.klasse.lernstandsbehauptung} | ${z.klasse.pending_als_lernstand} | ${z.anliegen.ja} / ${z.anliegen.nein} / ${z.anliegen['n/a']} |`;
  });
  const zeileGesamt = (name: string, z: Zaehler) =>
    `| ${name} | ${z.ausgaben} | ${z.eintraege} | ${z.mitFehler} (${pz(z.mitFehler, z.eintraege)}) | ${z.aussagenMitFehler}/${z.aussagen} (${pz(z.aussagenMitFehler, z.aussagen)}) | ${z.schritteMitFehler}/${z.schritte} (${pz(z.schritteMitFehler, z.schritte)}) | ${z.klasse.erfunden} | ${z.klasse.kennzahl_verwechselt} | ${z.anliegen.ja} / ${z.anliegen.nein} / ${z.anliegen['n/a']} |`;
  writeFileSync(
    path.join(ROOT, EV, 'quellentreue-auswertung.md'),
    `# Auftrag 2C – Auswertung des Quellentreue-Bogens

Erzeugt mit \`npx tsx referat/2c/quellentreue.ts\` · Arbeitsstand \`${head}\` · Produktcode 1.3.0 \`efd71b44\`.
Quelle: \`${QUELLE}\` (${zeilen.length} Zeilen, ${summeVorkommen} Einträge, ${alleAusgaben.size} Ausgaben).
**Bewertung: KI-Entwurf (Claude), von Antonius Richter geprüft.**

## Prüfung des Bogens

- LF-Zeilenenden, ${zeilen.length} Datenzeilen mit gleicher Feldzahl wie der Kopf.
- ${KLASSEN.map((k) => `\`${k}\``).join(', ')}: in allen ${zeilen.length} Zeilen \`ja\` oder \`nein\`.
- \`anliegen_fehlt\` ist je **Ausgabe** bewertet und nur bei \`statement\` Nr. 1 eingetragen (\`ja\`/\`nein\`/\`n/a\`), in den übrigen Zeilen leer. Jede der ${alleAusgaben.size} Ausgaben hat genau einen Wert.
- Summe \`vorkommen\` = ${summeVorkommen} = Zeilen der Langfassung \`quellentreue-bogen.csv\`; jede Zeile hat so viele \`lauf_ids\` wie \`vorkommen\`.
- Die Spalten außer den Fehlerklassen und \`bemerkung\` sind gegenüber der leeren Fassung unverändert.

## Zählweise

- Ein **Eintrag** ist eine Aussage (\`statement\`) oder ein nächster Schritt (\`suggestedNextStep\`) einer Ausgabe. Jede Bogenzeile zählt \`vorkommen\`-fach.
- **≥ 1 Fehler**: mindestens eine der Klassen \`erfunden\`, \`kennzahl_verwechselt\`, \`lernstandsbehauptung\`, \`pending_als_lernstand\` ist \`ja\`.
- **Anliegen fehlt** (ja / nein / n/a) zählt Ausgaben, nicht Einträge. n/a: Fall d hat kein vorgegebenes Anliegen der Fixture.
- **Gate angezeigt** = \`gate_ok = true\`, d. h. das Produkt zeigt den Modelltext statt der Extraktion.

## Je Fall und Variante

| Fall | Variante | Ausgaben | Gate angezeigt | Einträge | ≥ 1 Fehler | Aussagen mit Fehler | nächste Schritte mit Fehler | erfunden | Kennzahl verwechselt | Lernstand | pending als Lernstand | Anliegen fehlt ja / nein / n/a |
| ---- | -------- | -------: | -------------: | -------: | ---------: | ------------------: | --------------------------: | -------: | -------------------: | --------: | --------------------: | ------------------------------ |
${tab.join('\n')}

## Gesamt und nach Gate

| Menge | Ausgaben | Einträge | ≥ 1 Fehler | Aussagen mit Fehler | nächste Schritte mit Fehler | erfunden | Kennzahl verwechselt | Anliegen fehlt ja / nein / n/a |
| ----- | -------: | -------: | ---------: | ------------------: | --------------------------: | -------: | -------------------: | ------------------------------ |
${zeileGesamt('alle', gesamt)}
${zeileGesamt('Gate bestanden (angezeigt)', angezeigt)}
${zeileGesamt('Gate abgelehnt (Extraktion angezeigt)', nichtAngezeigt)}

## Abbildung

![Quellentreue je Fall und Variante](../abbildungen/2c/${datei})

\`referat/evidenz/abbildungen/2c/${datei}\` (PNG 300 dpi, ${groesse.breite} × ${groesse.hoehe}; SVG daneben).
`,
  );
  console.log(`ok ${datei} ${groesse.breite}x${groesse.hoehe}; ${gesamt.mitFehler}/${gesamt.eintraege} mit Fehler`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
