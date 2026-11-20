/**
 * Versuchscode Referat Thema 2 / Auftrag 2A, Schritt 3.4 – kein Produktpfad.
 *
 * Microbenchmark für
 *   (1) Kartenbildung: selectPendingModerationQuestionSourceIds +
 *       selectFrictionQuestionSourceIds + planModerationCompass
 *       (libs/shared-types/src/moderation-compass-rules.ts), Eingabe sind fertig
 *       vorbereitete Regelfragen wie in buildCompassContext (Scores kommen dort aus SQL
 *       und sind deshalb nicht Teil der Messung).
 *   (2) Extraktiver Fallback: createExtractiveQaSummaryOutput
 *       (apps/backend/src/lib/qaSummaryExtractive.ts) inklusive Zod-Validierung
 *       QaSummaryModelOutputV2Schema.parse.
 *
 * N = 50 / 500 / 2500 synthetische Fragen, 5 Warm-up-Läufe, 30 gemessene Wiederholungen.
 * Hinweis: Im Releasepfad begrenzt selectionLimits.questions = 40 den gepackten Kontext;
 * N = 500/2500 für den Fallback ist daher ein Belastungsfall oberhalb der Produktgrenze.
 *
 * Aufruf (Repo-Root):
 *   node --expose-gc --import tsx referat/2a/bench/aufwand.bench.ts
 */
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  MODERATION_PROMPT_CONTEXT_REFERENCE_FIXTURE_V1,
  planModerationCompass,
  selectFrictionQuestionSourceIds,
  selectPendingModerationQuestionSourceIds,
  type ModerationPromptContextV1,
} from '@arsnova/shared-types';
import {
  isQaControversialLabel,
  resolveQaControversyThreshold,
} from '../../../apps/backend/src/lib/qaControversy';
import { createExtractiveQaSummaryOutput } from '../../../apps/backend/src/lib/qaSummaryExtractive';
import { sqlBestScore, sqlControversyScore } from '../lib/regelkern';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const OUT_DIR = path.join(REPO_ROOT, 'referat/evidenz/2a');
const SIZES = [50, 500, 2500] as const;
const WARMUP = 5;
const REPS = 30;
/** Raumgröße für die Kartenbildung: Produkt-Referenzbasis N = 200 (T = 20). */
const P = 200;
const SEED = 0x2a2a2a2a;

const gc = (globalThis as { gc?: () => void }).gc;
if (!gc) {
  throw new Error('Bitte mit `node --expose-gc --import tsx …` starten (Heap-Delta braucht gc()).');
}

/** Deterministischer PRNG (mulberry32), damit jeder Lauf dieselben Fragen erzeugt. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type SynthQuestion = {
  sourceId: string;
  text: string;
  status: 'PENDING' | 'ACTIVE' | 'PINNED';
  positive: number;
  negative: number;
};

function synthQuestions(n: number): SynthQuestion[] {
  const rnd = mulberry32(SEED + n);
  const themen = ['lineare Regression', 'Kapitel 4', 'Anwesenheit', 'Übungsblatt', 'Klausur', 'Folien'];
  return Array.from({ length: n }, (_, i) => {
    const r = rnd();
    const status = r < 0.2 ? 'PENDING' : r < 0.3 ? 'PINNED' : 'ACTIVE';
    const total = Math.floor(rnd() * 121);
    const positive = Math.floor(total * rnd());
    const hex = i.toString(16).padStart(12, '0');
    return {
      sourceId: `qa-question:00000000-0000-4000-8000-${hex}`,
      text: `Synthetische Frage ${i + 1} zu ${themen[i % themen.length]}: Können wir das noch einmal an einem Beispiel durchgehen?`,
      status,
      positive,
      negative: total - positive,
    };
  });
}

function ruleQuestionsFor(questions: readonly SynthQuestion[]) {
  const T = resolveQaControversyThreshold(P);
  return questions.map((q) => {
    const controversyScore = sqlControversyScore(q.positive, q.negative, T);
    return {
      sourceId: q.sourceId,
      status: q.status,
      positiveVoteCount: q.positive,
      negativeVoteCount: q.negative,
      score: q.positive - q.negative,
      bestScore: sqlBestScore(q.positive, q.negative),
      controversyScore,
      isControversial: isQaControversialLabel({
        controversyScore,
        voteCount: q.positive + q.negative,
        controversyThreshold: T,
      }),
    } as const;
  });
}

function promptContextFor(questions: readonly SynthQuestion[]): ModerationPromptContextV1 {
  const base = structuredClone(MODERATION_PROMPT_CONTEXT_REFERENCE_FIXTURE_V1) as ModerationPromptContextV1;
  return {
    ...base,
    context: {
      ...base.context,
      // createExtractiveQaSummaryOutput liest nur locale und sources.
      sources: questions.map((q) => ({
        id: q.sourceId,
        kind: 'qa-question' as const,
        content: { state: 'included' as const, text: q.text, truncated: false },
      })),
    },
  } as ModerationPromptContextV1;
}

type Sample = { durationNs: number; heapDeltaBytes: number };

function measure(fn: () => unknown): Sample[] {
  let sink: unknown;
  for (let i = 0; i < WARMUP; i++) sink = fn();
  const samples: Sample[] = [];
  for (let i = 0; i < REPS; i++) {
    gc!();
    const heapBefore = process.memoryUsage().heapUsed;
    const t0 = process.hrtime.bigint();
    sink = fn();
    const t1 = process.hrtime.bigint();
    const heapAfter = process.memoryUsage().heapUsed;
    samples.push({ durationNs: Number(t1 - t0), heapDeltaBytes: heapAfter - heapBefore });
  }
  if (sink === undefined) throw new Error('Ergebnis fehlt');
  return samples;
}

/** Nearest-rank-Perzentil, wie scripts/load/qa-classroom-30.mjs. */
function percentile(values: readonly number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)]!;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function gitHead(): string {
  try {
    return execSync('git rev-parse HEAD', { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
  } catch {
    return 'unbekannt';
  }
}

const de = (v: number, d = 1) => v.toFixed(d).replace('.', ',');

function main(): void {
  const rawRows: string[] = ['szenario,n,wiederholung,dauer_ns,heap_delta_bytes'];
  const summary: Array<{
    szenario: string;
    n: number;
    medianUs: number;
    p95Us: number;
    minUs: number;
    maxUs: number;
    heapMedianKiB: number;
    heapP95KiB: number;
    info: string;
  }> = [];

  for (const n of SIZES) {
    const questions = synthQuestions(n);
    const ruleQuestions = ruleQuestionsFor(questions);
    const context = promptContextFor(questions);

    const scenarios: Array<{ name: string; fn: () => unknown; info: () => string }> = [
      {
        name: 'kartenbildung',
        fn: () => {
          const pending = selectPendingModerationQuestionSourceIds(ruleQuestions);
          const friction = selectFrictionQuestionSourceIds(
            ruleQuestions.filter((q) => q.status !== 'PENDING'),
          );
          return planModerationCompass({
            topicSourceIds: [],
            pendingQuestionSourceIds: pending,
            frictionQuestionSourceIds: friction,
            quizResultSourceIds: [],
            feedback: null,
          });
        },
        info: () => {
          const plan = planModerationCompass({
            topicSourceIds: [],
            pendingQuestionSourceIds: selectPendingModerationQuestionSourceIds(ruleQuestions),
            frictionQuestionSourceIds: selectFrictionQuestionSourceIds(
              ruleQuestions.filter((q) => q.status !== 'PENDING'),
            ),
            quizResultSourceIds: [],
            feedback: null,
          });
          return `${plan.cards.map((c) => `${c.kind}:${c.sourceIds.length}`).join(' ')}; next=${plan.recommendation?.reason ?? '-'}`;
        },
      },
      {
        name: 'extraktiv',
        fn: () => createExtractiveQaSummaryOutput(context),
        info: () => {
          const out = createExtractiveQaSummaryOutput(context);
          return `status=${out.status}; statements=${out.statements.length}`;
        },
      },
    ];

    for (const scenario of scenarios) {
      const samples = measure(scenario.fn);
      samples.forEach((s, i) =>
        rawRows.push(`${scenario.name},${n},${i + 1},${s.durationNs},${s.heapDeltaBytes}`),
      );
      const us = samples.map((s) => s.durationNs / 1000);
      const kib = samples.map((s) => s.heapDeltaBytes / 1024);
      summary.push({
        szenario: scenario.name,
        n,
        medianUs: median(us),
        p95Us: percentile(us, 95),
        minUs: Math.min(...us),
        maxUs: Math.max(...us),
        heapMedianKiB: median(kib),
        heapP95KiB: percentile(kib, 95),
        info: scenario.info(),
      });
    }
  }

  const meta = {
    erzeugt: new Date().toISOString(),
    head: gitHead(),
    node: process.version,
    v8: process.versions.v8,
    cpu: os.cpus()[0]?.model.trim() ?? 'unbekannt',
    logischeCpus: os.cpus().length,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(path.join(OUT_DIR, 'aufwand-roh.csv'), `${rawRows.join('\n')}\n`);
  writeFileSync(
    path.join(OUT_DIR, 'aufwand.csv'),
    [
      'szenario,n,median_us,p95_us,min_us,max_us,heap_delta_median_kib,heap_delta_p95_kib,info',
      ...summary.map(
        (s) =>
          `${s.szenario},${s.n},${s.medianUs.toFixed(2)},${s.p95Us.toFixed(2)},${s.minUs.toFixed(2)},${s.maxUs.toFixed(2)},${s.heapMedianKiB.toFixed(2)},${s.heapP95KiB.toFixed(2)},"${s.info}"`,
      ),
    ].join('\n') + '\n',
  );

  const md: string[] = [
    '# 2A · Aufwand Regelkern und extraktiver Fallback (Schritt 3.4)',
    '',
    `- Erzeugt: ${meta.erzeugt}`,
    `- HEAD Arbeitsbranch: \`${meta.head}\` (Produktcode = Referenz-Commit \`efd71b44\`)`,
    `- Laufzeit: Node ${meta.node} (V8 ${meta.v8}), \`--expose-gc\`, Single-Thread`,
    `- Hardware: ${meta.cpu}, ${meta.logischeCpus} logische CPUs, WSL2 – Details in \`referat/evidenz/manifest.md\``,
    '- Aufruf: `node --expose-gc --import tsx referat/2a/bench/aufwand.bench.ts`',
    `- Methode: je Szenario und N ${WARMUP} Warm-up-Läufe, dann ${REPS} Wiederholungen; vor jeder Wiederholung \`gc()\`; Dauer per \`process.hrtime.bigint()\`; Heap-Delta = \`heapUsed\` nach minus vor dem Aufruf (ohne GC dazwischen, also allokierter und noch nicht freigegebener Speicher). p95 nach Nearest-Rank.`,
    `- Eingabe: deterministisch erzeugte Fragen (mulberry32, Seed 0x2a2a2a2a + N), ca. 20 % PENDING, 10 % PINNED, 70 % ACTIVE, 0–120 Stimmen. Kartenbildung mit P = ${P} (T = ${resolveQaControversyThreshold(P)}).`,
    '- Kartenbildung misst nur die Regelfunktionen; Scores entstehen im Releasepfad in SQL und sind hier vorberechnet.',
    '- Fallback misst `createExtractiveQaSummaryOutput` inkl. Zod-Validierung. Im Releasepfad begrenzt `selectionLimits.questions = 40` den gepackten Kontext; N = 500 und 2500 liegen darüber und sind ein Belastungsfall.',
    '- Rohdaten: `aufwand-roh.csv` (eine Zeile je Wiederholung), Zusammenfassung: `aufwand.csv`',
    '',
    '| Szenario | N | Median [µs] | p95 [µs] | Min–Max [µs] | Heap-Delta Median [KiB] | Heap-Delta p95 [KiB] | Ergebnis |',
    '| -------- | -: | ----------: | -------: | -----------: | ----------------------: | -------------------: | -------- |',
    ...summary.map(
      (s) =>
        `| ${s.szenario} | ${s.n} | ${de(s.medianUs)} | ${de(s.p95Us)} | ${de(s.minUs)}–${de(s.maxUs)} | ${de(s.heapMedianKiB)} | ${de(s.heapP95KiB)} | ${s.info} |`,
    ),
    '',
  ];
  writeFileSync(path.join(OUT_DIR, 'aufwand.md'), md.join('\n'));
  console.log(md.slice(12).join('\n'));
}

main();
