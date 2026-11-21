/**
 * ============================================================================
 * VERSUCHSCODE – KEIN PRODUKTPFAD (Referat Thema 2, Auftrag 2C, Schritt 5.3)
 * ============================================================================
 * Ablationen der Moderationskurzfassung. Derselbe ModerationAnalysisContextV1-Snapshot
 * (einmal je Fall über buildModerationPromptContext gebaut) wird VOR dem Packen reduziert:
 *
 *   nur-texte        Fragetexte; Stimmen, Teilnehmerbasis und Beantwortungsstatus als
 *                    `unavailable/outside-scope`; Themen, Kompass, Lernziele entfernt.
 *                    `status` bleibt (Pflichtfeld; in allen Fällen ACTIVE, also ohne Information).
 *   texte-metadaten  Fragetexte + Stimmen + Status (+ Teilnehmerbasis für K);
 *                    ohne Themen, Kompasssignale, Lernziele.
 *
 * Danach unverändert der Produktweg: packSummaryModerationPromptContext (inkl.
 * trimSummaryAnalysisQuestions) → assemblePreparedModerationSummaryContext (derselbe
 * technische Prompt v5, dieselbe Ausgabegrenze) → runOpenWeightLlmSummaryV2 (temperature 0,
 * über den aufzeichnenden Proxy) → bindQaSummaryModelOutputV2. Zusätzlich wird das
 * Produkt-Qualitätsgate hasAcceptableQaSummaryQuality ausgewertet (im Produkt führt `false`
 * zum extraktiven Fallback).
 *
 * Host-Token aus referat/.local/, nie ausgegeben. Aufruf über referat/2c/start-harness.sh.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../..');
// Nur DATABASE_URL u. a. Basiswerte; OPEN_WEIGHT_LLM_* setzt start-harness.sh vorher
// (dotenv überschreibt gesetzte Variablen nicht). Keine Werte werden ausgegeben.
dotenv.config({ path: path.join(REPO_ROOT, '.env'), quiet: true });

type Variante = 'nur-texte' | 'texte-metadaten';
const ALLE_VARIANTEN: Variante[] = ['nur-texte', 'texte-metadaten'];

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(name);
  const v = i >= 0 ? process.argv[i + 1] : fallback;
  if (v === undefined) throw new Error(`${name} fehlt`);
  return v;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

const OUTSIDE = { state: 'unavailable', reason: 'outside-scope' } as const;

/** Reduktion vor dem Packen; Ergebnis wird gegen ModerationAnalysisContextV1Schema geprüft. */
function reduziere(analysis: Json, variante: Variante): Json {
  const a = structuredClone(analysis);
  const c = a.context;
  const entfernteKinds = new Set(['compass-signal', 'semantic-topic', 'learning-objective']);
  c.topics = { ...OUTSIDE };
  c.compass = { ...OUTSIDE };
  c.learningContext = { ...OUTSIDE };
  c.sources = c.sources.filter((s: Json) => !entfernteKinds.has(s.kind));
  c.limitations = c.limitations.filter(
    (l: Json) => !['topics', 'compass', 'learning-context'].includes(l.section),
  );
  if (c.questions.state === 'available') {
    c.questions.items = c.questions.items.map((q: Json) => ({ ...q, topicSourceIds: [] }));
    if (variante === 'nur-texte') {
      c.questions.participantBasis = { ...OUTSIDE };
      c.questions.items = c.questions.items.map((q: Json) => ({
        ...q,
        votes: { ...OUTSIDE },
        answerState: { ...OUTSIDE },
      }));
    }
  }
  return a;
}

async function main(): Promise<void> {
  const seedPath = arg('--seed');
  const fall = arg('--fall');
  const laeufe = Number(arg('--laeufe', '5'));
  const outDir = arg('--out');
  // Optional (Wiederholung nach OOM, 5.3): nur ausgewählte Varianten, mit Markierung je Lauf.
  const VARIANTEN = arg('--varianten', ALLE_VARIANTEN.join(','))
    .split(',')
    .map((v) => {
      if (!ALLE_VARIANTEN.includes(v as Variante)) throw new Error(`unbekannte Variante ${v}`);
      return v as Variante;
    });
  const marke = arg('--marke', '') || null;
  mkdirSync(outDir, { recursive: true });

  const shared = await import('@arsnova/shared-types');
  const { buildModerationPromptContext } =
    await import('../../apps/backend/src/lib/moderationPromptContext');
  const { packSummaryModerationPromptContext, assemblePreparedModerationSummaryContext } =
    await import('../../apps/backend/src/lib/moderationSummaryContext');
  const { runOpenWeightLlmSummaryV2 } =
    await import('../../apps/backend/src/lib/openWeightLlmClient');
  const { bindQaSummaryModelOutputV2 } =
    await import('../../apps/backend/src/lib/qaSummaryValidateV2');
  const { hasAcceptableQaSummaryQuality } =
    await import('../../apps/backend/src/lib/qaSummaryQuality');
  const { prisma } = await import('../../apps/backend/src/db');

  const seed = JSON.parse(readFileSync(path.resolve(REPO_ROOT, seedPath), 'utf8'));
  const hostToken: string = JSON.parse(
    readFileSync(path.resolve(REPO_ROOT, seed.tokenDatei), 'utf8'),
  ).hostToken;
  const keyOf = new Map<string, string>(
    (seed.fragen ?? []).filter((f: Json) => f.key).map((f: Json) => [f.sourceId, f.key]),
  );
  const label = (id: string) => keyOf.get(id) ?? id;

  try {
    const analysis = await buildModerationPromptContext({
      sessionId: seed.session.sessionId,
      locale: 'de',
      access: { hostToken },
    });
    writeFileSync(
      path.join(outDir, `${fall}-analysis-voll.json`),
      `${JSON.stringify(analysis, null, 2)}\n`,
    );

    const alle: Json[] = [];
    for (const variante of VARIANTEN) {
      const reduziert = shared.ModerationAnalysisContextV1Schema.parse(
        reduziere(analysis, variante),
      );
      const promptContext = packSummaryModerationPromptContext({ analysis: reduziert });
      const prepared = assemblePreparedModerationSummaryContext({
        promptContext,
        cache: 'miss',
      });
      const c = promptContext.context;
      const qaSources = c.sources.filter((s: Json) => s.kind === 'qa-question');
      const packed = {
        snapshotHash: promptContext.snapshotHash,
        budget: promptContext.budget,
        selectionLimits: c.scope.selectionLimits,
        corpus: c.questions.state === 'available' ? c.questions.corpus : null,
        representedItems:
          c.questions.state === 'available'
            ? c.questions.items.map((q: Json) => label(q.sourceId))
            : [],
        qaSources: qaSources.map((s: Json) => ({
          id: label(s.id),
          content: s.content?.state,
          truncated: s.content?.truncated ?? null,
        })),
        gepackteFragetexte: qaSources.filter((s: Json) => s.content?.state === 'included').length,
        sections: {
          topics: c.topics.state,
          compass: c.compass.state,
          learningContext: c.learningContext.state,
        },
        votesSichtbar:
          c.questions.state === 'available' &&
          c.questions.items.some((q: Json) => q.votes.state === 'available'),
        selectedMode: prepared.plan.selectedMode,
      };
      writeFileSync(
        path.join(outDir, `${fall}-${variante}-promptContext.json`),
        `${JSON.stringify(promptContext, null, 2)}\n`,
      );

      for (let lauf = 1; lauf <= laeufe; lauf += 1) {
        const startedAt = Date.now();
        const result = await runOpenWeightLlmSummaryV2(prepared.request);
        const endedAt = Date.now();
        const run: Json = {
          fall,
          variante,
          lauf,
          kalt: lauf === 1,
          marke,
          startedAt,
          endedAt,
          gesamtMs: endedAt - startedAt,
          packed,
          llmStatus: result.status,
        };
        if (result.status === 'completed') {
          const raw = result.output.output;
          const execution = shared.QaSummaryExecutionV2Schema.parse({
            attemptedMode: 'full-context',
            effectiveMode: 'full-context',
            fallback: null,
          });
          const bound = bindQaSummaryModelOutputV2({
            output: raw,
            prepared,
            execution,
            analyzedAt: new Date(endedAt).toISOString(),
          });
          const rawIds = [...raw.statements, ...raw.suggestedNextSteps].flatMap(
            (s: Json) => s.sourceIds,
          );
          const boundIds = new Set(
            [...bound.statements, ...bound.suggestedNextSteps].flatMap((s: Json) => s.sourceIds),
          );
          run.telemetry = result.telemetry;
          run.schemaGueltig = true;
          run.modellStatus = raw.status;
          run.qualitaetsgate = hasAcceptableQaSummaryQuality(raw, 'de');
          run.ergebnisStatus = bound.status;
          run.entfernteSourceIds = [
            ...new Set(rawIds.filter((id: string) => !boundIds.has(id))),
          ].map(label);
          run.statements = bound.statements.map((s: Json) => ({
            text: s.text,
            sourceIds: s.sourceIds.map(label),
          }));
          run.suggestedNextSteps = bound.suggestedNextSteps.map((s: Json) => ({
            text: s.text,
            sourceIds: s.sourceIds.map(label),
          }));
          run.limitations = bound.limitations;
          run.rohausgabe = raw;
        } else {
          run.schemaGueltig = false;
        }
        alle.push(run);
        writeFileSync(
          path.join(outDir, `${fall}-${variante}-lauf${lauf}.json`),
          `${JSON.stringify(run, null, 2)}\n`,
        );
        process.stdout.write(
          `${fall} ${variante} Lauf ${lauf}${lauf === 1 ? ' (kalt)' : ''}: ${run.llmStatus}` +
            `${run.schemaGueltig ? ` · ${run.ergebnisStatus} · Gate ${run.qualitaetsgate ? 'ok' : 'abgelehnt'}` : ''}` +
            ` · ${run.gesamtMs} ms · Fragetexte ${packed.gepackteFragetexte}: ${packed.qaSources.map((q: Json) => q.id).join(',')}\n`,
        );
      }
    }
    writeFileSync(path.join(outDir, `${fall}-laeufe.json`), `${JSON.stringify(alle, null, 2)}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((error: unknown) => {
    process.stderr.write(
      `Harness fehlgeschlagen: ${error instanceof Error ? error.stack : String(error)}\n`,
    );
    process.exit(1);
  });
