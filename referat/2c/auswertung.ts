/**
 * VERSUCHSCODE – KEIN PRODUKTPFAD (Referat 2C, Schritt 5.4 Auswertung).
 *
 * Liest alle Läufe aus referat/evidenz/2c/{baseline,ablation,ablation-wiederholung-nach-oom}/, ordnet jedem Lauf die
 * Runtime-Antwort aus referat/evidenz/2c/llm-exchanges.jsonl (aufzeichnender Proxy) über das
 * Zeitfenster zu und prüft die Rohausgabe des Modells mit denselben Produktbausteinen:
 * QaSummaryModelOutputV2Schema (Schema), Bindung an die erlaubten Quellen wie
 * bindQaSummaryModelOutputV2 (entfernte sourceIds) und hasAcceptableQaSummaryQuality (Gate).
 * Speicher je Lauf aus den Sampler-CSVs (RssAnon, RssFile, Swap, OOM) im Zeitfenster.
 *
 * Gültig = Runtime hat geantwortet (HTTP 200 mit Inhalt). Ungültige Läufe gehen in keine
 * Kennzahl ein; Läufe nach dem OOM-Kill (OOM_ZEIT) sind als `oom_betroffen` markiert.
 * Zeitwerte: `unter_swap` = memory.swap.current > 0 im Laufzeitfenster; Mediane getrennt für
 * swapfreie Läufe und Läufe unter Swap. Prefill: `kalt` = kein Prompt-Cache-Treffer
 * (cache_n < 50 % der Prompt-Tokens, echtes Prefill), `warm` = Cache-Treffer (nur Rest-Tokens).
 *
 * Ausgaben: referat/evidenz/2c/auswertung.csv, auswertung-tabelle.md, quellentreue-bogen.csv.
 * Aufruf: npx tsx referat/2c/auswertung.ts
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const EV = path.join(ROOT, 'referat/evidenz/2c');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

const FAELLE = ['a-P200', 'b-P200-lernziel', 'c-P50skaliert-lernziel', 'd-456-teilmenge'];
const VARIANTEN = [
  'voll',
  'nur-texte',
  'texte-metadaten',
  'texte-metadaten (Wdh. nach OOM-Neustart)',
];
const MODI: Array<{ modus: string; seedPrefix: string }> = [
  { modus: 'baseline', seedPrefix: 'baseline' },
  { modus: 'ablation', seedPrefix: 'ablation' },
  {
    modus: 'ablation-wiederholung-nach-oom',
    seedPrefix: 'ablation-ablation-wiederholung-nach-oom',
  },
];
// OOM-Kill der Runtime (docker events „oom“/„die 137“ 16:12:13 MEZ; Container-StartedAt
// nach Neustart 2026-11-20T15:12:13.594Z, RestartCount 1) → referat/evidenz/2c/ablation/oom-nachweis.json
const OOM_ZEIT = Date.parse('2026-11-20T15:12:13Z');

function readJson(p: string): Json {
  return JSON.parse(readFileSync(p, 'utf8'));
}
function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n;]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}
function median(xs: number[]): number | null {
  const v = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m]! : (v[m - 1]! + v[m]!) / 2;
}
const fmt = (x: number | null | undefined, d = 0) =>
  x === null || x === undefined || !Number.isFinite(x) ? '–' : x.toFixed(d).replace('.', ',');

async function main(): Promise<void> {
  const { QaSummaryModelOutputV2Schema } = await import('@arsnova/shared-types');
  const { hasAcceptableQaSummaryQuality } =
    await import('../../apps/backend/src/lib/qaSummaryQuality');

  const exchanges: Json[] = readFileSync(path.join(EV, 'llm-exchanges.jsonl'), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));

  const mib = (x: number | null) => (x === null ? '' : (x / 2 ** 20).toFixed(0));
  function memRows(modus: string, fall: string): Json[] {
    const p = path.join(EV, modus, `${fall}-mem.csv`);
    if (!existsSync(p)) return [];
    const [head, ...lines] = readFileSync(p, 'utf8').trim().split('\n');
    const keys = head!.split(',');
    return lines
      .map((l) => l.split(','))
      .filter((c) => c.length === keys.length)
      .map((c) => Object.fromEntries(keys.map((k, i) => [k, Number(c[i])])));
  }

  // Schlüssel A–F aus den Seeds (für Fall d: kurze Textlabels)
  function labeler(seedPrefix: string, fall: string): (id: string) => string {
    const seed = readJson(path.join(EV, 'seed', `${seedPrefix}-${fall}.json`));
    const m = new Map<string, string>();
    for (const f of seed.fragen ?? []) {
      if (f.key) m.set(f.sourceId, f.key);
      else m.set(f.sourceId, `#${String(f.text).slice(0, 40)}`);
    }
    return (id) => m.get(id) ?? id;
  }

  const rows: Json[] = [];
  const bogen: Json[] = [];
  for (const { modus, seedPrefix } of MODI) {
    const dir = path.join(EV, modus);
    if (!existsSync(dir)) continue;
    for (const fall of FAELLE) {
      const files = readdirSync(dir).filter(
        (f) => f.startsWith(`${fall}-`) && /-lauf\d+\.json$/.test(f),
      );
      if (!files.length) continue;
      const label = labeler(seedPrefix, fall);
      const mem = memRows(modus, fall);
      const preview =
        modus === 'baseline' ? readJson(path.join(dir, `${fall}-preview.json`)) : null;
      for (const file of files.sort()) {
        const doc = readJson(path.join(dir, file));
        const run = modus === 'baseline' ? doc.run : doc;
        const variante =
          modus === 'baseline'
            ? 'voll'
            : run.marke === 'nach-oom-neustart'
              ? `${run.variante} (Wdh. nach OOM-Neustart)`
              : run.variante;
        const pcVariante = modus === 'baseline' ? 'voll' : run.variante;
        const ex = exchanges.filter(
          (e) => e.startedAt >= run.startedAt - 50 && e.endedAt <= run.endedAt + 50,
        );
        const e = ex[0];
        const content: string | undefined = e?.response?.choices?.[0]?.message?.content;
        const t = e?.response?.timings ?? {};
        const u = e?.response?.usage ?? {};
        let parsed: Json = null;
        let schemaGueltig: boolean;
        try {
          const wire = JSON.parse(content ?? '');
          const r = QaSummaryModelOutputV2Schema.safeParse(wire.output);
          schemaGueltig = r.success;
          parsed = r.success ? r.data : null;
        } catch {
          schemaGueltig = false;
        }
        const promptContext =
          modus === 'baseline'
            ? preview.promptContext
            : readJson(path.join(dir, `${fall}-${pcVariante}-promptContext.json`));
        const allowed = new Set(
          promptContext.context.sources
            .filter(
              (s: Json) =>
                (s.content?.state ?? 'included') === 'included' || s.kind !== 'qa-question',
            )
            .map((s: Json) => s.id),
        );
        const rawStatements = parsed ? [...parsed.statements, ...parsed.suggestedNextSteps] : [];
        const rawIds = rawStatements.flatMap((s: Json) => s.sourceIds);
        const entfernt = [...new Set(rawIds.filter((id: string) => !allowed.has(id)))];
        const unbelegt = rawStatements.filter(
          (s: Json) => !s.sourceIds.some((id: string) => allowed.has(id)),
        ).length;
        const gate = parsed ? hasAcceptableQaSummaryQuality(parsed, 'de') : false;
        const w = mem.filter((m) => m.ts_ms >= run.startedAt && m.ts_ms <= run.endedAt);
        const peak = (k: string) => (w.length ? Math.max(...w.map((m) => m[k] ?? 0)) : null);
        const packed = run.packed;
        const gueltig = e?.status === 200 && typeof content === 'string' && content.length > 0;
        const llmStatus =
          modus === 'baseline' ? (gueltig ? 'completed' : 'fehlt') : (run.llmStatus ?? '');
        const oomBetroffen =
          !gueltig && run.startedAt >= OOM_ZEIT - 5_000 && run.startedAt <= OOM_ZEIT + 600_000;
        const promptTok = Number(u.prompt_tokens ?? NaN);
        const cacheN = Number(t.cache_n ?? NaN);
        const prefillArt = !gueltig ? '' : cacheN >= 0.5 * promptTok ? 'warm' : 'kalt';
        const swapPeak = peak('cg_swap_current');
        const fragen = packed.qaSources.map((q: Json) => q.id).join(' ');
        const row = {
          modus,
          fall,
          variante,
          lauf: run.lauf,
          kalt: run.kalt,
          marke: run.marke ?? '',
          gueltig,
          llm_status: llmStatus,
          oom_betroffen: oomBetroffen,
          fehler: gueltig ? '' : (e?.error ?? e?.status ?? 'keine Runtime-Antwort'),
          fragen_im_kontext: fragen,
          gepackte_fragetexte: packed.includedQuestionTexts ?? packed.gepackteFragetexte,
          represented: packed.corpus?.represented ?? '',
          limit_fragen: packed.selectionLimits?.questions ?? '',
          kuerzungen: (packed.budget?.truncations ?? [])
            .map((x: Json) => `${x.section}:${x.omittedItems}:${x.reason}`)
            .join(' '),
          daten_tokens_schaetzung: packed.budget?.dataTokens ?? '',
          llm_aufrufe: ex.length,
          http: e?.status ?? '',
          finish_reason: e?.response?.choices?.[0]?.finish_reason ?? '',
          schema_gueltig: gueltig ? schemaGueltig : '',
          modell_status: parsed?.status ?? '',
          gate_ok: gueltig ? gate : '',
          produkt_effektiv:
            modus === 'baseline'
              ? (run.execution?.effectiveMode ?? '')
              : gate
                ? 'full-context'
                : 'extractive',
          produkt_fallback: modus === 'baseline' ? (run.execution?.fallback?.reason ?? '') : '',
          produkt_status: modus === 'baseline' ? run.status : (run.ergebnisStatus ?? ''),
          aussagen_roh: parsed?.statements.length ?? '',
          entfernte_sourceids: entfernt.length,
          unbelegte_aussagen: unbelegt,
          prompt_tokens: u.prompt_tokens ?? '',
          completion_tokens: u.completion_tokens ?? '',
          cache_n: t.cache_n ?? '',
          prompt_n: t.prompt_n ?? '',
          prefill_art: prefillArt,
          prefill_ms: t.prompt_ms ?? '',
          predicted_ms: t.predicted_ms ?? '',
          tokens_pro_s: t.predicted_per_second ?? '',
          runtime_ms: e?.elapsedMs ?? '',
          gesamt_ms: run.gesamtMs,
          peak_rssanon_mib:
            peak('proc_rssanon_kb') === null ? '' : (peak('proc_rssanon_kb')! / 1024).toFixed(0),
          peak_rssfile_mib:
            peak('proc_rssfile_kb') === null ? '' : (peak('proc_rssfile_kb')! / 1024).toFixed(0),
          peak_cg_anon_mib: peak('cg_anon') === null ? '' : (peak('cg_anon')! / 2 ** 20).toFixed(0),
          peak_cg_current_mib: mib(peak('cg_current')),
          swap_mib: swapPeak === null ? '' : (swapPeak / 2 ** 20).toFixed(1),
          unter_swap: swapPeak === null ? '' : swapPeak > 0,
          oom_kill: peak('cg_oom_kill') ?? '',
          mem_samples: w.length,
        };
        rows.push(row);
        if (parsed) {
          parsed.statements.forEach((s: Json, i: number) =>
            bogen.push({
              modus,
              fall,
              variante,
              lauf: run.lauf,
              art: 'statement',
              nr: i + 1,
              gate_ok: gate,
              aussagetext: s.text,
              sourceIds: s.sourceIds.map(label).join(' '),
            }),
          );
          parsed.suggestedNextSteps.forEach((s: Json, i: number) =>
            bogen.push({
              modus,
              fall,
              variante,
              lauf: run.lauf,
              art: 'suggestedNextStep',
              nr: i + 1,
              gate_ok: gate,
              aussagetext: s.text,
              sourceIds: s.sourceIds.map(label).join(' '),
            }),
          );
        }
      }
    }
  }

  const cols = Object.keys(rows[0] ?? {});
  writeFileSync(
    path.join(EV, 'auswertung.csv'),
    `${[cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n')}\n`,
  );
  const fehlerKlassen = [
    'erfunden',
    'kennzahl_verwechselt',
    'anliegen_fehlt',
    'lernstandsbehauptung',
    'pending_als_lernstand',
    'bemerkung',
  ];
  const bcols = [
    'modus',
    'fall',
    'variante',
    'lauf',
    'art',
    'nr',
    'gate_ok',
    'aussagetext',
    'sourceIds',
    ...fehlerKlassen,
  ];
  writeFileSync(
    path.join(EV, 'quellentreue-bogen.csv'),
    `${[bcols.join(','), ...bogen.map((r) => bcols.map((c) => csvCell(r[c])).join(','))].join('\n')}\n`,
  );

  // Markdown-Tabellen je Fall × Variante: Qualität (alle gültigen Läufe) und Zeit (getrennt nach Swap)
  const med = (r: Json[], k: string, f = 1) => median(r.map((x) => Number(x[k]) / f));
  const q: string[] = [];
  q.push(
    '| Fall | Variante | Läufe | gültig | OOM-betroffen | Fragen im Kontext | Schema ok | Gate ok | Modellstatus uncertain | entfernte IDs | Prompt-Tok. | Compl.-Tok. |',
  );
  q.push(
    '| ---- | -------- | ----: | -----: | ------------: | ----------------- | --------: | ------: | ---------------------: | ------------: | ----------: | ----------: |',
  );
  const z: string[] = [];
  z.push(
    '| Fall | Variante | Messbedingung | n | Prefill kalt (ms, n) | Prompt-Cache-Treffer: Rest-Prefill (ms, n) | Tokens/s | Runtime-Antwort Median (s) | Gesamt Median (s) | Peak RssAnon (MiB) | Peak RssFile (MiB) | Swap max (MiB) |',
  );
  z.push(
    '| ---- | -------- | ------------- | -: | -------------------: | -----------------------------------------: | -------: | -------------------------: | ----------------: | -----------------: | -----------------: | -------------: |',
  );
  for (const fall of FAELLE) {
    for (const variante of VARIANTEN) {
      const alle = rows.filter((x) => x.fall === fall && x.variante === variante);
      if (!alle.length) continue;
      const r = alle.filter((x) => x.gueltig);
      const fragenSets = [...new Set(r.map((x) => x.fragen_im_kontext))];
      q.push(
        `| ${fall} | ${variante} | ${alle.length} | ${r.length} | ${alle.filter((x) => x.oom_betroffen).length} | ${fragenSets.map((f) => (fall.startsWith('d') ? `${f.split(' ').length} Fragen` : f)).join(' / ')} | ${r.filter((x) => x.schema_gueltig).length}/${r.length} | ${r.filter((x) => x.gate_ok).length}/${r.length} | ${r.filter((x) => x.modell_status === 'uncertain').length}/${r.length} | ${r.reduce((s2, x) => s2 + x.entfernte_sourceids, 0)} | ${fmt(med(r, 'prompt_tokens'))} | ${fmt(med(r, 'completion_tokens'))} |`,
      );
      for (const [bed, rr] of [
        ['swapfrei', r.filter((x) => x.unter_swap === false)],
        ['unter Swap gemessen', r.filter((x) => x.unter_swap === true)],
      ] as Array<[string, Json[]]>) {
        if (!rr.length) continue;
        const kalt = rr.filter((x) => x.prefill_art === 'kalt');
        const warm = rr.filter((x) => x.prefill_art === 'warm');
        z.push(
          `| ${fall} | ${variante} | ${bed} | ${rr.length} | ${fmt(med(kalt, 'prefill_ms'))} (${kalt.length}) | ${fmt(med(warm, 'prefill_ms'))} (${warm.length}) | ${fmt(med(rr, 'tokens_pro_s'), 1)} | ${fmt(med(rr, 'runtime_ms', 1000), 1)} | ${fmt(med(rr, 'gesamt_ms', 1000), 1)} | ${fmt(Math.max(...rr.map((x) => Number(x.peak_rssanon_mib) || 0)))} | ${fmt(Math.max(...rr.map((x) => Number(x.peak_rssfile_mib) || 0)))} | ${fmt(Math.max(...rr.map((x) => Number(x.swap_mib) || 0)))} |`,
        );
      }
    }
  }
  const lines = [
    '### Qualität (alle gültigen Läufe, unabhängig von Swap)',
    '',
    ...q,
    '',
    '### Zeit und Speicher (getrennt nach Messbedingung)',
    '',
    ...z,
  ];
  writeFileSync(path.join(EV, 'auswertung-tabelle.md'), `${lines.join('\n')}\n`);
  process.stdout.write(`${rows.length} Läufe, ${bogen.length} Bogenzeilen\n${lines.join('\n')}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    process.stderr.write(
      `Auswertung fehlgeschlagen: ${error instanceof Error ? error.stack : String(error)}\n`,
    );
    process.exit(1);
  });
