#!/usr/bin/env node
/**
 * VERSUCHSCODE (Referat 2C, Schritt 5.2 Baseline full-context) – kein Produktpfad.
 *
 * Fährt den echten Produktpfad über tRPC: je Lauf qa.summaryContextPreview (gepackter
 * Kontext, Budget, Kürzungen, welche Fragen enthalten sind), dann qa.requestSummary und
 * Polling von qa.summaryRuntime bis ready/uncertain/failed. Lauf 1 je Fall = „kalt“.
 * Zwischen den Läufen wird die Cooldown-Zeit (QA_SUMMARY_COOLDOWN_MS=5000) abgewartet,
 * damit kein Cache-Treffer entsteht. Rohantworten/Timings der Runtime liefert der
 * aufzeichnende Proxy (referat/2c/llm-proxy.mjs); die Zuordnung erfolgt über Zeitfenster.
 *
 * Host-Token wird aus referat/.local/ gelesen und nie ausgegeben oder gespeichert.
 *
 * Aufruf: node referat/2c/baseline-lauf.mjs --seed <seed.json> --fall <name> --laeufe 5 --out <dir>
 */
/* global process, setTimeout */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const arg = (n, d) => {
  const i = process.argv.indexOf(n);
  return i >= 0 ? process.argv[i + 1] : d;
};
const seedPath = arg('--seed');
const fall = arg('--fall');
const laeufe = Number(arg('--laeufe', '5'));
const outDir = arg('--out');
const pollMs = 2000;
const maxWaitMs = 300_000;
const cooldownWaitMs = 6000;
if (!seedPath || !fall || !outDir) throw new Error('--seed, --fall, --out sind Pflicht');

const { createHttpTrpcSingle } = await import(path.resolve('scripts/load/lib/trpc-runtime.mjs'));
const seed = JSON.parse(readFileSync(seedPath, 'utf8'));
const hostToken = JSON.parse(readFileSync(seed.tokenDatei, 'utf8')).hostToken;
const trpc = createHttpTrpcSingle('http://127.0.0.1:3000/trpc', hostToken);
const sessionId = seed.session.sessionId;
const keyOf = Object.fromEntries(
  (seed.fragen ?? []).filter((f) => f.key).map((f) => [f.sourceId, f.key]),
);
const label = (id) => keyOf[id] ?? id;
mkdirSync(outDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Kompakte Sicht: welche Fragen sind im gepackten Kontext, mit welchem Inhaltsstatus. */
export function packedView(promptContext) {
  const c = promptContext.context;
  const qa = c.sources.filter((s) => s.kind === 'qa-question');
  return {
    snapshotHash: promptContext.snapshotHash,
    budget: promptContext.budget,
    selectionLimits: c.scope.selectionLimits,
    corpus: c.questions.state === 'available' ? c.questions.corpus : c.questions,
    representedItems:
      c.questions.state === 'available' ? c.questions.items.map((q) => label(q.sourceId)) : [],
    qaSources: qa.map((s) => ({
      id: label(s.id),
      content: s.content?.state,
      truncated: s.content?.truncated ?? null,
    })),
    includedQuestionTexts: qa.filter((s) => s.content?.state === 'included').length,
    sections: Object.fromEntries(
      ['topics', 'compass', 'learningContext', 'releasedResults', 'feedback'].map((k) => [
        k,
        c[k]?.state,
      ]),
    ),
    compassSignals:
      c.compass?.state === 'available'
        ? c.compass.signals.map((s) => ({
            signal: s.signal,
            cardKind: s.cardKind,
            questions: s.questionSourceIds.map(label),
          }))
        : [],
    learningObjectives:
      c.learningContext?.state === 'available' ? c.learningContext.objectives.length : 0,
    limitations: c.limitations,
  };
}

const runs = [];
for (let lauf = 1; lauf <= laeufe; lauf += 1) {
  const preview = await trpc.qa.summaryContextPreview.query({ sessionId, locale: 'de' });
  if (lauf === 1)
    writeFileSync(
      path.join(outDir, `${fall}-preview.json`),
      `${JSON.stringify(preview, null, 2)}\n`,
    );
  const startedAt = Date.now();
  const pending = await trpc.qa.requestSummary.mutate({ sessionId, locale: 'de' });
  const enqueueMs = Date.now() - startedAt;
  let runtime = pending;
  let polls = 0;
  while (runtime.result?.status === 'pending' && Date.now() - startedAt < maxWaitMs) {
    await sleep(pollMs);
    polls += 1;
    runtime = await trpc.qa.summaryRuntime.query({ sessionId });
  }
  const endedAt = Date.now();
  const r = runtime.result;
  const run = {
    fall,
    lauf,
    kalt: lauf === 1,
    startedAt,
    endedAt,
    gesamtMs: endedAt - startedAt,
    enqueueMs,
    polls,
    pendingBeimStart: pending.result?.status ?? null,
    status: r?.status ?? null,
    execution: r?.execution ?? null,
    snapshotHashGleich: r?.snapshotHash === preview.promptContext.snapshotHash,
    selectedMode: preview.selectedMode,
    packed: packedView(preview.promptContext),
    statements: (r?.statements ?? []).map((s) => ({
      text: s.text,
      sourceIds: s.sourceIds.map(label),
    })),
    suggestedNextSteps: (r?.suggestedNextSteps ?? []).map((s) => ({
      text: s.text,
      sourceIds: s.sourceIds.map(label),
    })),
    limitations: r?.limitations ?? [],
  };
  runs.push(run);
  writeFileSync(
    path.join(outDir, `${fall}-lauf${lauf}.json`),
    `${JSON.stringify({ run, runtime }, null, 2)}\n`,
  );
  process.stdout.write(
    `${fall} Lauf ${lauf}${run.kalt ? ' (kalt)' : ''}: ${run.status} · ${run.execution?.effectiveMode ?? '-'}${run.execution?.fallback ? ` (${run.execution.fallback.reason})` : ''} · ${run.gesamtMs} ms · Fragen im Kontext: ${run.packed.qaSources.map((q) => q.id).join(',')}\n`,
  );
  if (lauf < laeufe) await sleep(cooldownWaitMs);
}
writeFileSync(path.join(outDir, `${fall}-laeufe.json`), `${JSON.stringify(runs, null, 2)}\n`);
