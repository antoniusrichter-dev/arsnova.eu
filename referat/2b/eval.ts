/**
 * ============================================================================
 * VERSUCHSCODE – KEIN PRODUKTPFAD (Referat Thema 2, Auftrag 2B, Schritt 4.2)
 * ============================================================================
 * Schickt die eigene Referenzmenge referat/2b/referenz.csv durch
 *   - die echte Kaskade `classifyQaNlpCascade` (Gatekeeper-NB + k-NN-Fallback, ADR-0032) und
 *   - die lexikalische Keyword-Baseline `predictQaNlpKeywordBaseline`,
 * jeweils mit QA_NLP_MIN_CONFIDENCE = 0.45 / 0.55 / 0.65 (genau ein Parameter variiert;
 * Abstand 0,22 und ≥ 6 Tokens bleiben Produkt-Defaults).
 *
 * Gold = label_person1 (nur EINE labelnde Person). Cohen's κ ist damit nicht berechenbar
 * und wird als `null` mit Begründung ausgegeben.
 *
 * „classified“: Kaskade = `status === 'classified'` (Produktlogik). Keyword-Baseline =
 * confidence ≥ Schwelle, wie `evaluateQaNlpPredictions` im Produkt (qaNlpEvaluate.ts).
 *
 * Macro-F1 wird in drei klar benannten Lesarten ausgegeben:
 *   macroF1Classified  nur über classified-Fälle (uncertain ausgeschlossen)
 *   macroF1Streng      uncertain zählt als falsch (Recall über alle Fälle, Precision über classified)
 *   macroF1BestGuess   Bestes Label für alle Fälle, unabhängig vom Status (Definition von
 *                      `evaluateQaNlpPredictions.macroF1` im Produkt)
 *
 * Ausgabe: referat/evidenz/2b/eval/ (ergebnis.json, vorhersagen.csv, ergebnis.md)
 * Aufruf aus Repo-Root: npx tsx referat/2b/eval.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyQaNlpCascade } from '../../apps/backend/src/lib/qaNlpCascade';
import {
  QA_NLP_EARLY_EXIT_MARGIN,
  QA_NLP_EARLY_EXIT_MIN_TOKENS,
  QA_NLP_MIN_CONFIDENCE_DEFAULT,
} from '../../apps/backend/src/lib/qaNlpConfig';
import { predictQaNlpKeywordBaseline } from '../../apps/backend/src/lib/qaNlpKeywordBaseline';
import { getQaNlpGatekeeperModel } from '../../apps/backend/src/lib/qaNlpGatekeeper';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const OUT = path.join(ROOT, 'referat/evidenz/2b/eval');
const SCHWELLEN = [0.45, 0.55, 0.65] as const;
const KAT = ['content', 'organization', 'technical'] as const;
type Kat = (typeof KAT)[number];
type Methode = 'kaskade' | 'keyword';

interface Item {
  id: string;
  text: string;
  sprache: string;
  gruppe: string;
  gold: Kat;
}
interface Vorhersage {
  id: string;
  methode: Methode;
  schwelle: number;
  status: 'classified' | 'uncertain';
  kategorie: Kat;
  konfidenz: number;
  stufe: string;
  earlyExit: boolean | null;
  usedFallback: boolean | null;
}

/** Minimaler RFC-4180-Parser (Anführungszeichen, Kommas und Zeilenumbrüche in Feldern). */
function parseCsv(src: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const text = src.replace(/^﻿/u, '');
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const [head, ...body] = rows.filter((r) => r.some((c) => c.trim()));
  return body.map((r) => Object.fromEntries(head!.map((h, i) => [h.trim(), r[i] ?? ''])));
}

const csvCell = (v: unknown): string => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/u.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};
const r4 = (x: number) => Number(x.toFixed(4));

function ladeReferenz(): Item[] {
  const rows = parseCsv(readFileSync(path.join(ROOT, 'referat/2b/referenz.csv'), 'utf8'));
  return rows.map((r) => {
    const gold = r['label_person1']?.trim() as Kat;
    if (!KAT.includes(gold)) throw new Error(`${r['id']}: label_person1 fehlt/ungültig (${gold})`);
    return { id: r['id']!, text: r['text']!, sprache: r['sprache']!, gruppe: r['gruppe']!, gold };
  });
}

function vorhersagen(items: Item[], methode: Methode, schwelle: number): Vorhersage[] {
  const analyzedAt = new Date('2026-01-01T00:00:00Z'); // fester Zeitstempel, beeinflusst nichts
  return items.map((item) => {
    if (methode === 'kaskade') {
      const d = classifyQaNlpCascade({ text: item.text }, schwelle, analyzedAt);
      return {
        id: item.id,
        methode,
        schwelle,
        status: d.status as 'classified' | 'uncertain',
        kategorie: (d.category ?? 'content') as Kat,
        konfidenz: d.confidence ?? 0,
        stufe: d.modelVersion,
        earlyExit: d.earlyExit,
        usedFallback: d.usedFallback,
      };
    }
    const p = predictQaNlpKeywordBaseline(item.text);
    return {
      id: item.id,
      methode,
      schwelle,
      status: p.confidence >= schwelle ? 'classified' : 'uncertain',
      kategorie: p.category as Kat,
      konfidenz: p.confidence,
      stufe: 'keyword-baseline',
      earlyExit: null,
      usedFallback: null,
    };
  });
}

function f1Tabelle(paare: Array<{ gold: Kat; pred: Kat | null }>) {
  // pred null = uncertain (zählt nur gegen den Recall)
  const perClass = {} as Record<
    Kat,
    { precision: number; recall: number; f1: number; support: number }
  >;
  for (const k of KAT) {
    const support = paare.filter((p) => p.gold === k).length;
    const tp = paare.filter((p) => p.gold === k && p.pred === k).length;
    const predPos = paare.filter((p) => p.pred === k).length;
    const precision = predPos ? tp / predPos : 0;
    const recall = support ? tp / support : 0;
    const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
    perClass[k] = { precision: r4(precision), recall: r4(recall), f1: r4(f1), support };
  }
  return { perClass, macroF1: r4(KAT.reduce((s, k) => s + perClass[k].f1, 0) / KAT.length) };
}

function metriken(items: Item[], vs: Vorhersage[]) {
  const byId = new Map(items.map((i) => [i.id, i]));
  const paare = vs.map((v) => ({ v, item: byId.get(v.id)! }));
  const cls = paare.filter((p) => p.v.status === 'classified');
  const richtigCls = cls.filter((p) => p.v.kategorie === p.item.gold).length;
  const confusion = Object.fromEntries(
    KAT.map((g) => [
      g,
      Object.fromEntries(
        [...KAT, 'uncertain'].map((c) => [
          c,
          paare.filter(
            (p) =>
              p.item.gold === g && (p.v.status === 'uncertain' ? 'uncertain' : p.v.kategorie) === c,
          ).length,
        ]),
      ),
    ]),
  );
  return {
    n: paare.length,
    classified: cls.length,
    abdeckung: r4(cls.length / paare.length),
    accuracyClassified: cls.length ? r4(richtigCls / cls.length) : null,
    macroF1Classified: f1Tabelle(cls.map((p) => ({ gold: p.item.gold, pred: p.v.kategorie })))
      .macroF1,
    macroF1Streng: f1Tabelle(
      paare.map((p) => ({
        gold: p.item.gold,
        pred: p.v.status === 'classified' ? p.v.kategorie : null,
      })),
    ).macroF1,
    macroF1BestGuess: f1Tabelle(paare.map((p) => ({ gold: p.item.gold, pred: p.v.kategorie })))
      .macroF1,
    accuracyBestGuess: r4(paare.filter((p) => p.v.kategorie === p.item.gold).length / paare.length),
    perClassClassified: f1Tabelle(cls.map((p) => ({ gold: p.item.gold, pred: p.v.kategorie })))
      .perClass,
    konfusion_gold_x_vorhersage: confusion,
  };
}

function gruppiert(items: Item[], vs: Vorhersage[], key: 'gruppe' | 'sprache') {
  const werte = [...new Set(items.map((i) => i[key]))].sort();
  return Object.fromEntries(
    werte.map((w) => {
      const ids = new Set(items.filter((i) => i[key] === w).map((i) => i.id));
      const m = metriken(
        items.filter((i) => ids.has(i.id)),
        vs.filter((v) => ids.has(v.id)),
      );
      return [
        w,
        {
          n: m.n,
          classified: m.classified,
          abdeckung: m.abdeckung,
          accuracyClassified: m.accuracyClassified,
          accuracyBestGuess: m.accuracyBestGuess,
          macroF1Streng: m.macroF1Streng,
        },
      ];
    }),
  );
}

/** Reliability: Konfidenz in 0,1-Bins gegen Trefferquote (alle Fälle, Bestes Label). */
function reliability(items: Item[], vs: Vorhersage[]) {
  const byId = new Map(items.map((i) => [i.id, i]));
  const bins = Array.from({ length: 10 }, (_, b) => ({
    von: b / 10,
    bis: (b + 1) / 10,
    n: 0,
    treffer: 0,
    konfSumme: 0,
    classified: 0,
  }));
  for (const v of vs) {
    const b = Math.min(9, Math.floor(v.konfidenz * 10));
    const bin = bins[b]!;
    bin.n += 1;
    bin.konfSumme += v.konfidenz;
    if (v.kategorie === byId.get(v.id)!.gold) bin.treffer += 1;
    if (v.status === 'classified') bin.classified += 1;
  }
  const out = bins
    .filter((b) => b.n)
    .map((b) => ({
      bin: `${b.von.toFixed(1)}–${b.bis.toFixed(1)}`,
      n: b.n,
      classified: b.classified,
      mittlereKonfidenz: r4(b.konfSumme / b.n),
      trefferquote: r4(b.treffer / b.n),
      luecke: r4(b.konfSumme / b.n - b.treffer / b.n),
    }));
  const ece = r4(out.reduce((s, b) => s + (b.n / vs.length) * Math.abs(b.luecke), 0));
  return { bins: out, ece };
}

function auffaelligsteFehler(items: Item[], vs: Vorhersage[], n = 10) {
  const byId = new Map(items.map((i) => [i.id, i]));
  return vs
    .filter((v) => v.kategorie !== byId.get(v.id)!.gold)
    .sort(
      (a, b) =>
        Number(b.status === 'classified') - Number(a.status === 'classified') ||
        b.konfidenz - a.konfidenz ||
        a.id.localeCompare(b.id),
    )
    .slice(0, n)
    .map((v) => {
      const i = byId.get(v.id)!;
      return {
        id: v.id,
        text: i.text,
        sprache: i.sprache,
        gruppe: i.gruppe,
        gold: i.gold,
        vorhersage: v.kategorie,
        status: v.status,
        konfidenz: r4(v.konfidenz),
        stufe: v.stufe,
        begruendung: '',
      };
    });
}

function main(): void {
  mkdirSync(OUT, { recursive: true });
  const items = ladeReferenz();
  const alle: Vorhersage[] = [];
  const varianten: Record<string, unknown> = {};
  for (const methode of ['kaskade', 'keyword'] as const) {
    for (const schwelle of SCHWELLEN) {
      const vs = vorhersagen(items, methode, schwelle);
      alle.push(...vs);
      varianten[`${methode}@${schwelle.toFixed(2)}`] = {
        methode,
        schwelle,
        istDefault: schwelle === QA_NLP_MIN_CONFIDENCE_DEFAULT,
        ...metriken(items, vs),
        kaskadenStufen:
          methode === 'kaskade'
            ? {
                earlyExit: vs.filter((v) => v.earlyExit).length,
                fallbackGenutzt: vs.filter((v) => v.usedFallback).length,
              }
            : null,
        jeGruppe: gruppiert(items, vs, 'gruppe'),
        jeSprache: gruppiert(items, vs, 'sprache'),
        reliability: reliability(items, vs),
        auffaelligsteFehler: auffaelligsteFehler(items, vs),
      };
    }
  }
  // Sensitivität (keine Label-Änderung): Labelregel 2 (Prüfungsrelevanz → organization) widerspricht
  // dem Repo-Seed (qaNlpSeed.ts, z. B. „Ist Aufgabe 3 klausurrelevant?“ = content) und dem
  // Keyword-Lexikon (klausur/pruefung/exam/relevant = content). Teilmenge per Muster bestimmt,
  // IDs werden ausgegeben und sind von der labelnden Person zu prüfen.
  const PRUEFUNG = /klausur|prüfung|pruefung|exam|examen|relevant|kommt .* dran|au programme/iu;
  const pruefIds = new Set(items.filter((i) => PRUEFUNG.test(i.text)).map((i) => i.id));
  const ohne = items.filter((i) => !pruefIds.has(i.id));
  const sensitivitaet = {
    beschreibung:
      'Metriken ohne Fragen zur Prüfung/Klausur/Relevanz (Musterabgleich), weil Labelregel 2 hier vom Repo-Seed abweicht. Labels unverändert.',
    muster: PRUEFUNG.source,
    ausgeschlossen: items
      .filter((i) => pruefIds.has(i.id))
      .map((i) => ({ id: i.id, gold: i.gold, gruppe: i.gruppe, text: i.text })),
    n: ohne.length,
    varianten: Object.fromEntries(
      (['kaskade', 'keyword'] as const).flatMap((methode) =>
        SCHWELLEN.map((schwelle) => {
          const m = metriken(ohne, vorhersagen(ohne, methode, schwelle));
          return [
            `${methode}@${schwelle.toFixed(2)}`,
            {
              abdeckung: m.abdeckung,
              classified: m.classified,
              accuracyClassified: m.accuracyClassified,
              macroF1Classified: m.macroF1Classified,
              macroF1Streng: m.macroF1Streng,
              macroF1BestGuess: m.macroF1BestGuess,
            },
          ];
        }),
      ),
    ),
  };
  // Sensitivität 2 (keine Label-Änderung): nur die 5 echten Konfliktfälle ausschließen, wie von der
  // labelnden Person nach Prüfung der 10 Muster-IDs festgelegt (Prüfungsrelevanz R003, R004, R026,
  // R057; Grenzfall R053). Termin- (R007, R037, R061, R071) und Hilfsmittelfragen (R036) bleiben drin.
  const KONFLIKT_IDS = ['R003', 'R004', 'R026', 'R053', 'R057'] as const;
  const konfliktSet = new Set<string>(KONFLIKT_IDS);
  const fehlend = KONFLIKT_IDS.filter((id) => !items.some((i) => i.id === id));
  if (fehlend.length > 0) throw new Error(`Konflikt-IDs fehlen in der Referenzmenge: ${fehlend.join(', ')}`);
  const ohneKonflikt = items.filter((i) => !konfliktSet.has(i.id));
  const sensitivitaetKonflikt = {
    beschreibung:
      'Metriken ohne die 5 echten Konfliktfälle zur Prüfungsrelevanz (feste ID-Liste nach Prüfung durch die labelnde Person). Termin- und Hilfsmittelfragen bleiben enthalten. Labels unverändert.',
    ausgeschlossen: items
      .filter((i) => konfliktSet.has(i.id))
      .map((i) => ({ id: i.id, gold: i.gold, gruppe: i.gruppe, text: i.text })),
    n: ohneKonflikt.length,
    varianten: Object.fromEntries(
      (['kaskade', 'keyword'] as const).flatMap((methode) =>
        SCHWELLEN.map((schwelle) => {
          const m = metriken(ohneKonflikt, vorhersagen(ohneKonflikt, methode, schwelle));
          return [
            `${methode}@${schwelle.toFixed(2)}`,
            {
              abdeckung: m.abdeckung,
              classified: m.classified,
              accuracyClassified: m.accuracyClassified,
              macroF1Classified: m.macroF1Classified,
              macroF1Streng: m.macroF1Streng,
              macroF1BestGuess: m.macroF1BestGuess,
            },
          ];
        }),
      ),
    ),
  };
  const ergebnis = {
    erzeugt: new Date().toISOString(),
    referenz: 'referat/2b/referenz.csv',
    n: items.length,
    goldVerteilung: Object.fromEntries(
      KAT.map((k) => [k, items.filter((i) => i.gold === k).length]),
    ),
    gruppen: Object.fromEntries(
      [...new Set(items.map((i) => i.gruppe))]
        .sort()
        .map((g) => [g, items.filter((i) => i.gruppe === g).length]),
    ),
    sprachen: Object.fromEntries(
      [...new Set(items.map((i) => i.sprache))]
        .sort()
        .map((s) => [s, items.filter((i) => i.sprache === s).length]),
    ),
    labeling: {
      personen: 1,
      gold: 'label_person1',
      cohensKappa: null,
      uneinigkeit: null,
      grund: 'Nur eine labelnde Person (Einzel-Labeling); κ und Uneinigkeit nicht berechenbar.',
    },
    produktKonstanten: {
      gatekeeperModell: getQaNlpGatekeeperModel().version,
      minConfidenceDefault: QA_NLP_MIN_CONFIDENCE_DEFAULT,
      earlyExitMargin: QA_NLP_EARLY_EXIT_MARGIN,
      earlyExitMinTokens: QA_NLP_EARLY_EXIT_MIN_TOKENS,
    },
    definitionen: {
      classifiedKaskade: "status === 'classified' aus classifyQaNlpCascade",
      classifiedKeyword: 'confidence ≥ Schwelle (wie evaluateQaNlpPredictions)',
      macroF1Classified: 'nur classified-Fälle',
      macroF1Streng: 'uncertain zählt als falsch (Recall über alle, Precision über classified)',
      macroF1BestGuess: 'Bestes Label für alle Fälle (Produktdefinition evaluateQaNlpPredictions)',
      reliability:
        '0,1-Bins der Konfidenz gegen Trefferquote des besten Labels, alle Fälle; ECE gewichtet',
    },
    varianten,
    sensitivitaetPruefungsrelevanz: sensitivitaet,
    sensitivitaetKonfliktfaelle: sensitivitaetKonflikt,
  };
  writeFileSync(path.join(OUT, 'ergebnis.json'), `${JSON.stringify(ergebnis, null, 2)}\n`);

  const byId = new Map(items.map((i) => [i.id, i]));
  const cols = [
    'id',
    'sprache',
    'gruppe',
    'gold',
    'methode',
    'schwelle',
    'status',
    'kategorie',
    'konfidenz',
    'richtig',
    'stufe',
    'earlyExit',
    'usedFallback',
    'text',
  ];
  writeFileSync(
    path.join(OUT, 'vorhersagen.csv'),
    `${[
      cols.join(','),
      ...alle.map((v) => {
        const i = byId.get(v.id)!;
        const row: Record<string, unknown> = {
          ...v,
          sprache: i.sprache,
          gruppe: i.gruppe,
          gold: i.gold,
          text: i.text,
          konfidenz: r4(v.konfidenz),
          richtig: v.kategorie === i.gold,
        };
        return cols.map((c) => csvCell(row[c])).join(',');
      }),
    ].join('\n')}\n`,
  );

  // Kurzübersicht
  const pct = (x: number | null) =>
    x === null ? '–' : `${(x * 100).toFixed(1).replace('.', ',')} %`;
  const dez = (x: number | null) => (x === null ? '–' : x.toFixed(3).replace('.', ','));
  const zeilen = [
    '| Variante | Abdeckung | Accuracy (classified) | Macro-F1 classified | Macro-F1 streng | Macro-F1 Bestes Label | Accuracy Bestes Label | ECE |',
    '| -------- | --------: | --------------------: | ------------------: | --------------: | --------------------: | --------------------: | --: |',
    ...Object.entries(varianten).map(([k, v]) => {
      const m = v as ReturnType<typeof metriken> & {
        reliability: { ece: number };
        istDefault: boolean;
      };
      return `| ${k}${m.istDefault ? ' (Default)' : ''} | ${pct(m.abdeckung)} (${m.classified}/${m.n}) | ${pct(m.accuracyClassified)} | ${dez(m.macroF1Classified)} | ${dez(m.macroF1Streng)} | ${dez(m.macroF1BestGuess)} | ${pct(m.accuracyBestGuess)} | ${dez(m.reliability.ece)} |`;
    }),
  ];
  writeFileSync(path.join(OUT, 'uebersicht.md'), `${zeilen.join('\n')}\n`);
  process.stdout.write(
    `${items.length} Fragen, ${alle.length} Vorhersagen\n${zeilen.join('\n')}\n`,
  );
}

main();
