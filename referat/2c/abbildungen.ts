/**
 * ============================================================================
 * VERSUCHSCODE – KEIN PRODUKTPFAD (Referat Thema 2, Auftrag 2C, Schritt 6.1)
 * ============================================================================
 * Abbildungen aus 5.2–5.4:
 *   (1) Qualität (automatisches Produkt-Gate) vs. TTFT (Prefill kalt) je Variante
 *   (2) Welche Fragen A–F je Fall/Variante im Kontext standen (Fälle a–c)
 *   (3) Gate-Ergebnis je Fall/Variante mit Ablehnungsgrund
 *   (4) Speicherverlauf des llama-server bis zum OOM
 * Eingaben: referat/evidenz/2c/auswertung.csv, gate-gruende.txt, {baseline,ablation}/<fall>-mem.csv, ablation/oom-nachweis.json
 * Ausgabe: referat/evidenz/abbildungen/2c/ (PNG 300 dpi, SVG, index.md)
 * Aufruf aus Repo-Root: npx tsx referat/2c/abbildungen.ts
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FARBE, de, kreis, linie, pfad, rahmen, rechteck, skala, speichere, text } from '../abbildungen/svg';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const EV = 'referat/evidenz/2c';
const OUT = path.join(ROOT, 'referat/evidenz/abbildungen/2c');
const head = execSync('git rev-parse --short=8 HEAD', { cwd: ROOT }).toString().trim();

/** Minimaler CSV-Parser (Felder ohne eingebettete Zeilenumbrüche, Anführungszeichen erlaubt). */
function csv(datei: string): Record<string, string>[] {
  const zeilen = readFileSync(path.join(ROOT, datei), 'utf8').replace(/^﻿/u, '').split(/\r?\n/u).filter(Boolean);
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
  return zeilen.slice(1).map((z) => Object.fromEntries(teile(z).map((v, i) => [kopf[i]!, v])));
}

const laeufe = csv(`${EV}/auswertung.csv`);
const FAELLE = [
  { key: 'a-P200', kurz: 'a', name: 'a · P200' },
  { key: 'b-P200-lernziel', kurz: 'b', name: 'b · P200 + Lernziel' },
  { key: 'c-P50skaliert-lernziel', kurz: 'c', name: 'c · P50-skaliert + Lernziel' },
  { key: 'd-456-teilmenge', kurz: 'd', name: 'd · #456-Teilmenge' },
] as const;
const VARIANTEN = [
  { key: 'voll', name: 'voll (Baseline)', farbe: FARBE.serie[0] },
  { key: 'nur-texte', name: 'nur Texte', farbe: FARBE.serie[1] },
  { key: 'texte-metadaten', name: 'Texte + Metadaten', farbe: FARBE.serie[2] },
] as const;
const WDH = 'texte-metadaten (Wdh. nach OOM-Neustart)';

function gruppe(fall: string, variante: string) {
  return laeufe.filter((r) => r.fall === fall && r.variante === variante);
}

// Gate-Gründe aus gate-gruende.txt (Zeilenformat: "<modus> <fall> <variante…> {'<grund>': n, …}")
const gruende = new Map<string, Record<string, number>>();
for (const z of readFileSync(path.join(ROOT, `${EV}/gate-gruende.txt`), 'utf8').split(/\r?\n/u)) {
  const m = /^(\S+) (\S+) (.+?) (\{.*\})$/u.exec(z.trim());
  if (!m) continue;
  const obj = JSON.parse(m[4]!.replace(/'/gu, '"')) as Record<string, number>;
  gruende.set(`${m[1]}|${m[2]}|${m[3]}`, obj);
}

// ---------------------------------------------------------------- (1) Qualität vs. TTFT
interface Punkt {
  fall: (typeof FAELLE)[number];
  variante: string;
  farbe: string;
  ttftS: number;
  gateOk: number;
  gueltig: number;
  swap: boolean;
  wdh: boolean;
}
function punkte(): Punkt[] {
  const out: Punkt[] = [];
  for (const f of FAELLE) {
    for (const v of [...VARIANTEN.map((x) => x.key), WDH]) {
      const g = gruppe(f.key, v).filter((r) => r.gueltig === 'true');
      if (!g.length) continue;
      const kalt = g.find((r) => r.kalt === 'true' && r.prefill_art === 'kalt');
      if (!kalt) continue;
      out.push({
        fall: f,
        variante: v,
        farbe: VARIANTEN.find((x) => x.key === (v === WDH ? 'texte-metadaten' : v))!.farbe,
        ttftS: Number(kalt.prefill_ms) / 1000,
        gateOk: g.filter((r) => r.gate_ok === 'true').length,
        gueltig: g.length,
        swap: kalt.unter_swap === 'true',
        wdh: v === WDH,
      });
    }
  }
  return out;
}

function abbildungQualitaetTtft(pk: Punkt[]): string {
  const B = 560;
  const H = 330;
  const L = 120;
  const R = B - 150;
  const O = 70;
  const U = H - 66;
  const x = skala(0, 35, L, R);
  const bahnen = [
    { y: O + (U - O) * 0.25, name: 'Gate bestanden', unter: 'Modelltext sichtbar' },
    { y: O + (U - O) * 0.75, name: 'Gate abgelehnt', unter: 'extraktiver Fallback' },
  ];
  const t: string[] = [];
  for (const b of bahnen) {
    t.push(linie(L, b.y, R, b.y, FARBE.gitter, 0.75));
    t.push(text(L - 10, b.y - 1, b.name, { groesse: 7.5, anker: 'end', fett: true }));
    t.push(text(L - 10, b.y + 9, b.unter, { groesse: 6.5, anker: 'end', farbe: FARBE.text2 }));
  }
  t.push(linie(L, U, R, U, FARBE.achse, 1));
  for (let s = 0; s <= 35; s += 5) {
    t.push(linie(x(s), U, x(s), U + 4, FARBE.achse, 1));
    t.push(text(x(s), U + 13, de(s), { groesse: 7, anker: 'middle', farbe: FARBE.text2 }));
  }
  t.push(text(L + (R - L) / 2, U + 28, 'TTFT ≈ Prefill kalt in s (erster Lauf je Fall/Variante, ohne Prompt-Cache)', { groesse: 7.5, anker: 'middle', farbe: FARBE.text2 }));

  // Je Bahn Punkte nach x sortiert; überlappende Punkte vertikal staffeln
  const belegte: { x: number; y: number }[] = [];
  for (const p of [...pk].sort((a, b) => a.ttftS - b.ttftS)) {
    const bahn = p.gateOk === p.gueltig && p.gateOk > 0 ? bahnen[0]! : bahnen[1]!;
    const px = x(p.ttftS);
    let py = bahn.y;
    let stufe = 0;
    while (belegte.some((q) => Math.abs(q.x - px) < 11 && Math.abs(q.y - py) < 11)) {
      stufe += 1;
      py = bahn.y + (stufe % 2 ? -1 : 1) * Math.ceil(stufe / 2) * 12;
    }
    belegte.push({ x: px, y: py });
    if (p.swap) t.push(`<circle cx="${px}" cy="${py}" r="4.5" fill="${FARBE.flaeche}" stroke="${p.farbe}" stroke-width="2"/>`);
    else t.push(kreis(px, py, 4.5, p.farbe, FARBE.flaeche, 1.5));
    t.push(text(px, py + 2.3, `${p.fall.kurz}${p.wdh ? '*' : ''}`, { groesse: 5.5, anker: 'middle', farbe: p.swap ? FARBE.text : FARBE.flaeche, fett: true }));
  }
  // Legende
  const lx = R + 14;
  let ly = O;
  t.push(text(lx, ly, 'Variante', { groesse: 7, fett: true }));
  for (const v of VARIANTEN) {
    ly += 12;
    t.push(kreis(lx + 5, ly - 2.5, 4, v.farbe, FARBE.flaeche, 1));
    t.push(text(lx + 14, ly, v.name, { groesse: 7 }));
  }
  ly += 18;
  t.push(text(lx, ly, 'Messbedingung', { groesse: 7, fett: true }));
  ly += 12;
  t.push(kreis(lx + 5, ly - 2.5, 4, FARBE.text2, FARBE.flaeche, 1));
  t.push(text(lx + 14, ly, 'swapfrei', { groesse: 7 }));
  ly += 12;
  t.push(`<circle cx="${lx + 5}" cy="${ly - 2.5}" r="3.5" fill="${FARBE.flaeche}" stroke="${FARBE.text2}" stroke-width="1.8"/>`);
  t.push(text(lx + 14, ly, 'unter Swap gemessen', { groesse: 7 }));
  ly += 18;
  t.push(text(lx, ly, 'Buchstabe = Fall a–d', { groesse: 6.5, farbe: FARBE.text2 }));
  t.push(text(lx, ly + 9, 'd* = Wiederholung nach OOM', { groesse: 6.5, farbe: FARBE.text2 }));
  t.push(text(lx, ly + 22, 'Qualität hier nur automatisch', { groesse: 6.5, farbe: FARBE.text2 }));
  t.push(text(lx, ly + 31, '(Gate); Quellentreue wird', { groesse: 6.5, farbe: FARBE.text2 }));
  t.push(text(lx, ly + 40, 'manuell bewertet.', { groesse: 6.5, farbe: FARBE.text2 }));
  return rahmen(
    B,
    H,
    '2C · Qualität und TTFT je Variante',
    'Nur drei Ablationen (a: beide, b: nur Texte) passieren das Gate; die volle Baseline scheitert in allen Fällen.',
    `Quelle: ${EV}/auswertung.csv (5.2–5.4, 65 Läufe) · Qwen3-4B Q4_K_M, llama.cpp b10524 · Produktcode efd71b44 · erzeugt auf ${head}`,
    t.join('\n'),
  );
}

// ---------------------------------------------------------------- (2) Fragen A–F im Kontext
function abbildungKontext(): { svg: string; zeilen: string[] } {
  const FR = ['A', 'B', 'C', 'D', 'E', 'F'];
  const INFO: Record<string, string> = {
    A: 'Regression · 80/30',
    B: 'Regression · 10/0',
    C: 'Klausur Kap. 4 · 30/0',
    D: 'Klausur Kap. 4 · 12/0',
    E: 'Anwesenheit · 40/40',
    F: 'Anwesenheit · 20/20',
  };
  const B = 540;
  const zeilenDef = FAELLE.slice(0, 3).flatMap((f) => VARIANTEN.map((v) => ({ f, v })));
  const zellB = 52;
  const zellH = 20;
  const L = 150;
  const O = 96;
  const H = O + zeilenDef.length * zellH + 26 * 3 + 76;
  const t: string[] = [];
  FR.forEach((q, i) => {
    t.push(text(L + i * zellB + zellB / 2, O - 22, q, { groesse: 9, anker: 'middle', fett: true }));
    const [thema, stimmen] = INFO[q]!.split(' · ');
    t.push(text(L + i * zellB + zellB / 2, O - 12, thema!, { groesse: 5.5, anker: 'middle', farbe: FARBE.text2 }));
    t.push(text(L + i * zellB + zellB / 2, O - 4, `U/D ${stimmen}`, { groesse: 5.5, anker: 'middle', farbe: FARBE.text2 }));
  });
  const tab: string[] = [];
  let y = O;
  zeilenDef.forEach(({ f, v }, zi) => {
    if (zi % 3 === 0) {
      y += zi > 0 ? 26 : 12;
      t.push(text(24, y - 4, f.name, { groesse: 7.5, fett: true }));
    }
    t.push(text(L - 8, y + zellH / 2 + 3, v.name, { groesse: 7, anker: 'end', farbe: FARBE.text2 }));
    const g = gruppe(f.key, v.key).filter((r) => r.gueltig === 'true');
    const reihe = (g[0]?.fragen_im_kontext ?? '').split(' ').filter(Boolean);
    FR.forEach((q, i) => {
      const x0 = L + i * zellB + 1;
      const pos = reihe.indexOf(q);
      if (pos >= 0) {
        t.push(rechteck(x0, y + 1, zellB - 2, zellH - 2, v.farbe, 'rx="3"'));
        t.push(text(x0 + (zellB - 2) / 2, y + zellH / 2 + 3, `${pos + 1}.`, { groesse: 7.5, anker: 'middle', farbe: FARBE.flaeche, fett: true }));
      } else {
        t.push(rechteck(x0, y + 1, zellB - 2, zellH - 2, '#f3f2ef', 'rx="3"'));
        t.push(text(x0 + (zellB - 2) / 2, y + zellH / 2 + 3, '–', { groesse: 7, anker: 'middle', farbe: FARBE.text2 }));
      }
    });
    tab.push(`| ${f.name} | ${v.name} | ${reihe.join(', ')} | ${FR.filter((q) => !reihe.includes(q)).join(', ')} |`);
    y += zellH;
  });
  t.push(text(24, y + 16, 'Farbige Zelle = im Kontext; Zahl = Position im gepackten Prompt (packed.qaSources). Grau = nicht im Kontext.', { groesse: 6.5, farbe: FARBE.text2 }));
  t.push(text(24, y + 26, 'Limit bei < 100 Fragen: 3 (moderationSummaryContext.ts:195–197).', { groesse: 6.5, farbe: FARBE.text2 }));
  t.push(text(24, y + 36, 'Fall d stammt aus dem #456-Korpus (8 von 300 Fragen gepackt) und hat keine Fragen A–F; er fehlt hier.', { groesse: 6.5, farbe: FARBE.text2 }));
  const svg = rahmen(
    B,
    H,
    '2C · Welche Fixture-Fragen das Modell sieht',
    'Die Baseline packt immer E, F, C; A, B und D erreichen das Modell nie. Ohne Kompasssignale wechselt die Auswahl.',
    `Quelle: ${EV}/auswertung.csv, Spalte fragen_im_kontext (in allen 5 Läufen je Gruppe gleich) · Produktcode efd71b44 · erzeugt auf ${head}`,
    t.join('\n'),
  );
  return { svg, zeilen: tab };
}

// ---------------------------------------------------------------- (3) Gate-Ergebnis
function gateText(fall: string, variante: string): { ok: boolean | null; zeile1: string; zeile2: string; zeile3: string } {
  const g = gruppe(fall, variante);
  if (!g.length) return { ok: null, zeile1: '', zeile2: '', zeile3: '' };
  const gueltig = g.filter((r) => r.gueltig === 'true');
  const ok = gueltig.filter((r) => r.gate_ok === 'true').length;
  const ungueltig = g.length - gueltig.length;
  const modus = variante === WDH ? 'ablation-wiederholung-nach-oom' : variante === 'voll' ? 'baseline' : 'ablation';
  const gr = gruende.get(`${modus}|${fall}|${variante === WDH ? 'texte-metadaten' : variante}`);
  if (!gr) throw new Error(`Kein Gate-Grund für ${modus}|${fall}|${variante}`);
  const abgelehnt = Object.keys(gr).filter((k) => k !== 'ok' && k !== 'ungültig');
  const kurzGrund = [...new Set(abgelehnt.map((k) => (k.startsWith('Z80') ? 'Z. 80 doppelter Lead' : k.startsWith('Z68') ? 'Z. 68 ohne Lead' : k)))].join(', ');
  const zeile1 = `${ok}/${gueltig.length} bestanden`;
  const zeile2 = ok === gueltig.length ? 'Modelltext sichtbar' : kurzGrund;
  const zeile3 = ungueltig ? `+ ${ungueltig} ungültig (OOM)` : '';
  return { ok: ok === gueltig.length && ok > 0, zeile1, zeile2, zeile3 };
}

function abbildungGate(): { svg: string; zeilen: string[] } {
  const spalten = [...VARIANTEN.map((v) => ({ key: v.key, name: v.name })), { key: WDH, name: 'Texte + Metadaten, Wdh.' }];
  const B = 560;
  const L = 150;
  const zellB = 96;
  const zellH = 40;
  const O = 84;
  const H = O + FAELLE.length * zellH + 64;
  const t: string[] = [];
  spalten.forEach((s, i) => t.push(text(L + i * zellB + zellB / 2, O - 8, s.name, { groesse: 7, anker: 'middle', fett: true })));
  const tab: string[] = [];
  FAELLE.forEach((f, zi) => {
    const y = O + zi * zellH;
    t.push(text(24, y + zellH / 2 + 3, f.name, { groesse: 7.5, fett: true }));
    spalten.forEach((s, i) => {
      const x0 = L + i * zellB + 2;
      const g = gateText(f.key, s.key);
      if (g.ok === null) {
        t.push(text(x0 + (zellB - 4) / 2, y + zellH / 2 + 3, '–', { groesse: 7, anker: 'middle', farbe: FARBE.text2 }));
        return;
      }
      const farbe = g.ok ? FARBE.gut : FARBE.kritisch;
      t.push(rechteck(x0, y + 2, zellB - 4, zellH - 4, '#ffffff', `rx="4" stroke="${farbe}" stroke-width="1.5"`));
      t.push(rechteck(x0, y + 2, 5, zellH - 4, farbe, 'rx="2"'));
      t.push(text(x0 + 11, y + 15, `${g.ok ? '✓' : '✗'} ${g.zeile1}`, { groesse: 7.5, fett: true }));
      t.push(text(x0 + 11, y + 24, g.zeile2, { groesse: 6, farbe: FARBE.text2 }));
      if (g.zeile3) t.push(text(x0 + 11, y + 32, g.zeile3, { groesse: 6, farbe: FARBE.text2 }));
      tab.push(`| ${f.name} | ${s.name} | ${g.zeile1} | ${g.zeile2}${g.zeile3 ? ` ${g.zeile3}` : ''} |`);
    });
  });
  const yU = O + FAELLE.length * zellH;
  t.push(text(L, yU + 14, 'Gate: hasAcceptableQaSummaryQuality (qaSummaryQuality.ts:59); abgelehnt → extraktiver Fallback mit invalid_response.', { groesse: 6.5, farbe: FARBE.text2 }));
  t.push(text(L, yU + 24, 'Z. 68: Aussage ohne „Thema: Aussage“-Lead · Z. 80: doppelter Lead. Alle gültigen Läufe waren schema-gültig.', { groesse: 6.5, farbe: FARBE.text2 }));
  const svg = rahmen(
    B,
    H,
    '2C · Ergebnis des Qualitätsgates je Fall und Variante',
    'Baseline 0/20 bestanden; nur drei Ablationen kommen durch – das Gate prüft die Form, nicht die Quellentreue.',
    `Quelle: ${EV}/auswertung.csv (gate_ok), ${EV}/gate-gruende.txt · Gegenprobe 65/65 gleich mit Produkt-Gate · erzeugt auf ${head}`,
    t.join('\n'),
  );
  return { svg, zeilen: tab };
}

// ---------------------------------------------------------------- (4) Speicherverlauf bis OOM
const MEM_DATEIEN = [
  { datei: 'baseline/a-P200-mem.csv', name: 'B a' },
  { datei: 'baseline/b-P200-lernziel-mem.csv', name: 'B b' },
  { datei: 'baseline/c-P50skaliert-lernziel-mem.csv', name: 'B c' },
  { datei: 'baseline/d-456-teilmenge-mem.csv', name: 'B d' },
  { datei: 'ablation/a-P200-mem.csv', name: 'A a' },
  { datei: 'ablation/b-P200-lernziel-mem.csv', name: 'A b' },
  { datei: 'ablation/c-P50skaliert-lernziel-mem.csv', name: 'A c' },
  { datei: 'ablation/d-456-teilmenge-mem.csv', name: 'A d' },
];
const MIB = 1024 * 1024;
function uhr(ms: number): string {
  // MEZ = UTC+1 (November, keine Sommerzeit)
  const d = new Date(ms + 3_600_000);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

function abbildungSpeicher(): { svg: string; zeilen: string[]; oom: string } {
  const oomInfo = JSON.parse(readFileSync(path.join(ROOT, `${EV}/ablation/oom-nachweis.json`), 'utf8')) as {
    startedAt: string;
    memory: number;
    memorySwap: number;
  };
  const oomMs = Date.parse(oomInfo.startedAt);
  const abschnitte = MEM_DATEIEN.map((m) => {
    const r = csv(`${EV}/${m.datei}`);
    return {
      ...m,
      t0: Number(r[0]!.ts_ms),
      t1: Number(r[r.length - 1]!.ts_ms),
      anon: r.filter((z) => z.proc_rssanon_kb).map((z) => [Number(z.ts_ms), Number(z.proc_rssanon_kb) / 1024] as [number, number]),
      file: r.filter((z) => z.proc_rssfile_kb).map((z) => [Number(z.ts_ms), Number(z.proc_rssfile_kb) / 1024] as [number, number]),
      swap: r.filter((z) => z.cg_swap_current).map((z) => [Number(z.ts_ms), Number(z.cg_swap_current) / MIB] as [number, number]),
    };
  });
  const B = 580;
  const H = 340;
  const L = 60;
  const R = B - 140;
  const O = 74;
  const U = H - 66;
  const tMin = abschnitte[0]!.t0 - 60_000;
  const tMax = oomMs + 90_000;
  const x = skala(tMin, tMax, L, R);
  const limit = oomInfo.memory / MIB;
  const y = skala(0, 6000, U, O);
  const t: string[] = [];
  for (const a of abschnitte) {
    t.push(rechteck(x(a.t0), O, x(a.t1) - x(a.t0), U - O, a.name.startsWith('B') ? '#f6f6f4' : '#f0eff9'));
    t.push(text((x(a.t0) + x(a.t1)) / 2, O - 4, a.name, { groesse: 6, anker: 'middle', farbe: FARBE.text2 }));
  }
  t.push(text(x(abschnitte[0]!.t0), O - 14, 'B = Baseline 5.2 · A = Ablation 5.3 · Buchstabe = Fall', { groesse: 6, farbe: FARBE.text2 }));
  for (let m = 0; m <= 6000; m += 1000) {
    t.push(linie(L, y(m), R, y(m), FARBE.gitter, 0.5));
    t.push(text(L - 6, y(m) + 2.5, de(m), { groesse: 7, anker: 'end', farbe: FARBE.text2 }));
  }
  t.push(text(18, O + (U - O) / 2, 'MiB', { groesse: 7.5, anker: 'middle', farbe: FARBE.text2, drehen: -90 }));
  t.push(linie(L, y(limit), R, y(limit), FARBE.text2, 1, '4 3'));
  t.push(text(L + 4, y(limit) - 4, `Containerlimit RAM ${de(limit / 1024)} GiB · Swap-Anteil max. ${de((oomInfo.memorySwap - oomInfo.memory) / MIB / 1024)} GiB`, { groesse: 6.5, farbe: FARBE.text2 }));
  t.push(linie(L, U, R, U, FARBE.achse, 1));
  const start = Math.ceil(tMin / 300_000) * 300_000;
  for (let ms = start; ms <= tMax; ms += 300_000) {
    t.push(linie(x(ms), U, x(ms), U + 4, FARBE.achse, 1));
    t.push(text(x(ms), U + 13, uhr(ms), { groesse: 6.5, anker: 'middle', farbe: FARBE.text2 }));
  }
  t.push(text(L + (R - L) / 2, U + 28, 'Uhrzeit 2026-11-20 (MEZ); Lücken = keine Messung zwischen den Fällen', { groesse: 7, anker: 'middle', farbe: FARBE.text2 }));
  const SER = [
    { key: 'anon', name: 'RssAnon llama-server', farbe: FARBE.serie[0] },
    { key: 'swap', name: 'Swap (cgroup)', farbe: FARBE.serie[1] },
    { key: 'file', name: 'RssFile (GGUF mmap)', farbe: FARBE.serie[2] },
  ] as const;
  for (const s of SER) for (const a of abschnitte) t.push(pfad(a[s.key].map(([ts, v]) => [x(ts), y(v)]), s.farbe, 1.5));
  t.push(linie(x(oomMs), O, x(oomMs), U, FARBE.kritisch, 1.5));
  t.push(text(x(oomMs) - 3, U - 30, `OOM ${uhr(oomMs)}:${String(new Date(oomMs).getUTCSeconds()).padStart(2, '0')}`, { groesse: 7, anker: 'end', fett: true }));
  t.push(text(x(oomMs) - 3, U - 20, 'exitCode 137, Neustart', { groesse: 6.5, anker: 'end', farbe: FARBE.text2 }));
  // Legende mit Direktwerten (Maximum je Serie)
  const lx = R + 14;
  let ly = O;
  t.push(text(lx, ly, 'Serie (Maximum)', { groesse: 7, fett: true }));
  const zeilen: string[] = [];
  for (const s of SER) {
    ly += 12;
    const mx = Math.max(...abschnitte.flatMap((a) => a[s.key].map(([, v]) => v)));
    t.push(linie(lx, ly - 2.5, lx + 14, ly - 2.5, s.farbe, 2));
    t.push(text(lx + 18, ly, s.name, { groesse: 7 }));
    t.push(text(lx + 18, ly + 9, `max. ${de(mx)} MiB`, { groesse: 6.5, farbe: FARBE.text2 }));
    ly += 9;
  }
  ly += 18;
  for (const z of [
    'Ursache (5.4): entrypoint.sh setzt',
    'kein --cache-ram; Default 8192 MiB',
    'liegt über dem Limit. Prompt-Cache',
    'wächst, Kernel lagert aus, bis',
    'RAM + Swap (10 GiB) voll sind.',
  ]) {
    t.push(text(lx, ly, z, { groesse: 6.3, farbe: FARBE.text2 }));
    ly += 9;
  }
  for (const a of abschnitte) {
    const mx = (k: 'anon' | 'swap' | 'file') => Math.max(...a[k].map(([, v]) => v));
    zeilen.push(`| ${a.name} | \`${EV}/${a.datei}\` | ${uhr(a.t0)}–${uhr(a.t1)} | ${de(mx('anon'))} | ${de(mx('swap'))} | ${de(mx('file'))} |`);
  }
  const svg = rahmen(
    B,
    H,
    '2C · Speicherverlauf der Runtime bis zum OOM',
    'RssAnon läuft ab Baseline c ans 5-GiB-Limit; danach wächst nur noch der Swap, bis der Container beendet wird.',
    `Quelle: ${EV}/{baseline,ablation}/*-mem.csv (Sampler 1 s), ${EV}/ablation/oom-nachweis.json · erzeugt auf ${head}`,
    t.join('\n'),
  );
  return { svg, zeilen, oom: oomInfo.startedAt };
}

async function main(): Promise<void> {
  const pk = punkte();
  const d1 = 'qualitaet-ttft.png';
  const d2 = 'fragen-im-kontext.png';
  const d3 = 'gate-ergebnis.png';
  const d4 = 'speicher-bis-oom.png';
  const g1 = await speichere(abbildungQualitaetTtft(pk), path.join(OUT, d1));
  const k = abbildungKontext();
  const g2 = await speichere(k.svg, path.join(OUT, d2));
  const ga = abbildungGate();
  const g3 = await speichere(ga.svg, path.join(OUT, d3));
  const sp = abbildungSpeicher();
  const g4 = await speichere(sp.svg, path.join(OUT, d4));
  const tab1 = pk.map(
    (p) => `| ${p.fall.name} | ${p.variante} | ${de(p.ttftS, 1)} | ${p.gateOk}/${p.gueltig} | ${p.swap ? 'unter Swap' : 'swapfrei'} |`,
  );
  writeFileSync(
    path.join(OUT, 'index.md'),
    `# Abbildungen 2C

Erzeugt mit \`npx tsx referat/2c/abbildungen.ts\` · Arbeitsstand \`${head}\` · Produktcode 1.3.0 \`efd71b44\` · Runtime llama.cpp b10524, Qwen3-4B-Instruct-2507 Q4_K_M (Manifest) · PNG 300 dpi, SVG daneben als Quelle.

## ${d1}

![Qualität und TTFT](${d1})

- **Datenquelle:** \`${EV}/auswertung.csv\` (5.4). Je Fall/Variante der erste, kalte Lauf (\`kalt = true\`, \`prefill_art = kalt\`); \`prefill_ms\` als Näherung für TTFT (Zeit bis zum ersten Token ≈ Prefill). Gate-Anteil über alle gültigen Läufe der Gruppe.
- **Qualität** ist hier nur das automatische Produkt-Gate (\`gate_ok\`). Die Quellentreue ist manuell bewertet (\`quellentreue-bogen-kompakt.csv\`) und nicht Teil dieser Abbildung; Auswertung in \`quellentreue-fehler.png\` (unten).
- Hohl = erster Lauf unter Swap gemessen (\`unter_swap\`); diese Zeiten sind nicht mit swapfreien vergleichbar. d* = Wiederholung nach OOM-Neustart (swapfrei, aber langsamer; Ursache nicht belegt, siehe \`auswertung.md\`).

| Fall | Variante | Prefill kalt (s) | Gate bestanden | Messbedingung Lauf 1 |
| ---- | -------- | ---------------: | -------------: | -------------------- |
${tab1.join('\n')}

## ${d2}

![Fragen im Kontext](${d2})

- **Datenquelle:** \`${EV}/auswertung.csv\`, Spalte \`fragen_im_kontext\` (= \`packed.qaSources\` in Reihenfolge des Prompts). In allen 5 gültigen Läufen je Gruppe identisch.
- Fall d (#456-Korpus) hat keine Fixture-Fragen A–F und ist nicht dargestellt.

| Fall | Variante | im Kontext (Reihenfolge) | nicht im Kontext |
| ---- | -------- | ------------------------ | ---------------- |
${k.zeilen.join('\n')}

## ${d3}

![Gate-Ergebnis](${d3})

- **Datenquelle:** \`${EV}/auswertung.csv\` (\`gate_ok\`, \`gueltig\`) und \`${EV}/gate-gruende.txt\` (erste verletzte Bedingung, \`referat/2c/gate-gruende.py\`).
- Status mit Symbol und Text (✓/✗), nicht nur über Farbe.

| Fall | Variante | Ergebnis | Grund |
| ---- | -------- | -------- | ----- |
${ga.zeilen.join('\n')}

## ${d4}

![Speicherverlauf bis OOM](${d4})

- **Datenquelle:** Sampler \`*-mem.csv\` (1 s; RssAnon/RssFile aus \`/proc/<llama-server>/status\`, Swap = cgroup \`memory.swap.current\`). OOM-Zeitpunkt = Container-Neustart \`StartedAt\` ${sp.oom} aus \`${EV}/ablation/oom-nachweis.json\` (docker events live abgelesen, siehe Protokoll 5.3).
- Gezeigt sind 5.2 und 5.3 bis zum OOM. Die Wiederholung von d nach dem Neustart (19:33–19:37 MEZ, RssAnon max. 3 783 MiB, Swap 0) und die Probe 5.1 sind nicht eingezeichnet.

| Abschnitt | Datei | Zeit (MEZ) | RssAnon max (MiB) | Swap max (MiB) | RssFile max (MiB) |
| --------- | ----- | ---------- | ----------------: | -------------: | ----------------: |
${sp.zeilen.join('\n')}

## quellentreue-fehler.png

![Quellentreue je Fall und Variante](quellentreue-fehler.png)

- Erzeugt mit \`npx tsx referat/2c/quellentreue.ts\` (eigenes Skript, nicht Teil von \`referat/2c/abbildungen.ts\`); Tabellen und Zählweise in \`referat/evidenz/2c/quellentreue-auswertung.md\`.
- **Datenquelle:** \`referat/evidenz/2c/quellentreue-bogen-kompakt.csv\` (Bewertung: KI-Entwurf von Claude, von Antonius Richter geprüft).

Pixelmaße: ${d1} ${g1.breite} × ${g1.hoehe}, ${d2} ${g2.breite} × ${g2.hoehe}, ${d3} ${g3.breite} × ${g3.hoehe}, ${d4} ${g4.breite} × ${g4.hoehe}.
`,
  );
  console.log(`ok ${d1}, ${d2}, ${d3}, ${d4}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
