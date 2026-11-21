/**
 * ============================================================================
 * VERSUCHSCODE – KEIN PRODUKTPFAD (Referat Thema 2, Auftrag 2B, Schritt 4.4)
 * ============================================================================
 * Prüft die Kontextschnittstelle #456 gegen ein laufendes Backend mit QA_NLP_ENABLED=true:
 *
 *  1. Frische Q&A-Session, 8 Fragen per qa.submit (echte Klassifikation im Backend), warten
 *     bis keine Frage mehr PENDING ist.
 *  2. Fixture-Zustände per Prisma an eigenen Seed-Zeilen setzen, damit alle Status vorkommen:
 *     Frage 1 → PENDING (Felder leer, wie ein noch nicht gelaufener Job), Frage 2 → FAILED
 *     (stub:queue-limit), Frage 3 → DISABLED. Übrige bleiben CLASSIFIED/UNCERTAIN.
 *  3. Vorher-Schnappschuss: nlp*-Felder aller Fragen (DB), qa.nlpRuntime.metrics (Backend),
 *     Anzahl qa_nlp:-Logzeilen (Backend-Log).
 *  4. Kontextabruf: 3 × qa.summaryContextPreview (HTTP, Backend-Prozess) und 1 ×
 *     buildModerationPromptContext in diesem Prozess (QA_NLP_ENABLED=true, eigener
 *     Queue-Zähler `enqueued` vorher/nachher).
 *  5. 2 s warten, Nachher-Schnappschuss. Erwartung: DB, Metriken und Log unverändert,
 *     PENDING bleibt PENDING, enqueued bleibt 0.
 *  5b. Gegenprobe: ein weiterer echter qa.submit muss completed +1 und neue Logzeilen erzeugen.
 *  6. Feldvergleich: nlp jeder Frage im vollen Analysekontext und im gepackten Preview gegen
 *     die DB-Zeile (Status → state, Kategorie, Konfidenz, Modellversion, Zeitstempel).
 *
 * Host-Token/Capabilities nur im Speicher. Nur Loopback.
 * Aufruf aus Repo-Root: npx tsx referat/2b/kontext-pruefung.ts --log <backend.log> --out <datei.json>
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const TRPC_URL = 'http://127.0.0.1:3000/trpc';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

function arg(name: string): string {
  const i = process.argv.indexOf(name);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  if (!v) throw new Error(`${name} fehlt`);
  return v;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const TEXTE = [
  'Können wir mehr Beispiele zur linearen Regression bearbeiten?',
  'Ist Kapitel 4 klausurrelevant?',
  'Soll die Anwesenheit verpflichtend sein?',
  'Mein Bildschirm bleibt schwarz, wenn ich den Link öffne',
  'Warum folgt aus einem Zusammenhang nicht automatisch eine Ursache?',
  'Wann ist die Abgabefrist für das Projekt?',
  'The audio stream keeps cutting out, can you check the microphone?',
  'Kannst du die Herleitung der Varianz noch einmal erklären?',
];

async function main(): Promise<void> {
  const logPath = arg('--log');
  const out = arg('--out');
  process.env['QA_NLP_ENABLED'] = 'true'; // für den In-Prozess-Abruf (Zähler dieses Prozesses)
  dotenv.config({ path: path.join(ROOT, '.env'), quiet: true });
  const { prisma } = await import('../../apps/backend/src/db');
  const { buildModerationPromptContext } =
    await import('../../apps/backend/src/lib/moderationPromptContext');
  const { getQaNlpMetrics } = await import('../../apps/backend/src/lib/qaNlpQueue');
  const { createHttpTrpcSingle } =
    (await import('../../scripts/load/lib/trpc-runtime.mjs')) as Json;
  const { configureQaSessionIfNeeded } =
    (await import('../../scripts/load/lib/configure-qa-if-needed.mjs')) as Json;

  const logZeilen = () => (readFileSync(logPath, 'utf8').match(/qa_nlp:/gu) ?? []).length;

  try {
    const pub = createHttpTrpcSingle(TRPC_URL);
    const created = await pub.session.create.mutate({
      type: 'Q_AND_A',
      title: 'Referat T2G8 · 2B Kontextschnittstelle',
      moderationMode: false,
      qaModerationMode: false,
      quickFeedbackEnabled: false,
      allowCustomNicknames: true,
      nicknameTheme: 'HIGH_SCHOOL',
      anonymousMode: false,
      teamMode: false,
    });
    const host = createHttpTrpcSingle(TRPC_URL, created.hostToken);
    await configureQaSessionIfNeeded(host, created.code, { qaTitle: 'Referat 2B Kontext' });
    const runtimeVorSeed = await host.qa.nlpRuntime.query({ sessionId: created.sessionId });
    if (!runtimeVorSeed.enabled) throw new Error('Backend läuft nicht mit QA_NLP_ENABLED=true');
    const tn: Json[] = [];
    for (let i = 0; i < 2; i += 1) {
      const p = await pub.session.join.mutate({
        code: created.code,
        nickname: `Referat T2G8 TN ${i + 1}`,
        anonymousClientId: globalThis.crypto.randomUUID(),
        joinIdempotencyKey: globalThis.crypto.randomUUID(),
      });
      tn.push({
        ...p,
        trpc: createHttpTrpcSingle(TRPC_URL, undefined, undefined, undefined, p.rejoinToken),
      });
    }
    const fragenIds: string[] = [];
    for (let k = 0; k < TEXTE.length; k += 1) {
      const t = tn[k % 2];
      const r = await t.trpc.qa.submit.mutate({
        sessionId: created.sessionId,
        participantId: t.participantId,
        text: TEXTE[k]!,
        idempotencyKey: globalThis.crypto.randomUUID(),
      });
      fragenIds.push(r.question.id);
    }
    for (let i = 0; i < 50; i += 1) {
      const pending = await prisma.qaQuestion.count({
        where: { sessionId: created.sessionId, nlpStatus: 'PENDING' },
      });
      if (pending === 0) break;
      await sleep(200);
    }
    const nachSubmit = await prisma.qaQuestion.findMany({
      where: { sessionId: created.sessionId },
      select: { id: true, nlpStatus: true, nlpCategory: true, nlpModelVersion: true },
      orderBy: { createdAt: 'asc' },
    });

    // Fixture-Zustände an eigenen Seed-Zeilen
    await prisma.qaQuestion.update({
      where: { id: fragenIds[0]! },
      data: {
        nlpStatus: 'PENDING',
        nlpCategory: null,
        nlpConfidence: null,
        nlpModelVersion: null,
        nlpAnalyzedAt: null,
      },
    });
    await prisma.qaQuestion.update({
      where: { id: fragenIds[1]! },
      data: {
        nlpStatus: 'FAILED',
        nlpCategory: null,
        nlpConfidence: null,
        nlpModelVersion: 'stub:queue-limit',
        nlpAnalyzedAt: new Date(),
      },
    });
    await prisma.qaQuestion.update({
      where: { id: fragenIds[2]! },
      data: {
        nlpStatus: 'DISABLED',
        nlpCategory: null,
        nlpConfidence: null,
        nlpModelVersion: null,
        nlpAnalyzedAt: null,
      },
    });

    const db = async () =>
      (
        await prisma.qaQuestion.findMany({
          where: { sessionId: created.sessionId },
          select: {
            id: true,
            text: true,
            nlpStatus: true,
            nlpCategory: true,
            nlpConfidence: true,
            nlpModelVersion: true,
            nlpAnalyzedAt: true,
            updatedAt: true,
          },
          orderBy: { id: 'asc' },
        })
      ).map((r: Json) => ({
        ...r,
        nlpAnalyzedAt: r.nlpAnalyzedAt?.toISOString() ?? null,
        updatedAt: r.updatedAt.toISOString(),
      }));

    await sleep(500);
    const vorher = {
      db: await db(),
      metrics: (await host.qa.nlpRuntime.query({ sessionId: created.sessionId })).metrics,
      logZeilen: logZeilen(),
      inProzessEnqueued: getQaNlpMetrics().enqueued,
    };

    // Kontextabruf
    const previews: Json[] = [];
    for (let i = 0; i < 3; i += 1) {
      previews.push(
        await host.qa.summaryContextPreview.query({ sessionId: created.sessionId, locale: 'de' }),
      );
    }
    const analysis = await buildModerationPromptContext({
      sessionId: created.sessionId,
      locale: 'de',
      access: { hostToken: created.hostToken },
    });
    await sleep(2000);

    const nachher = {
      db: await db(),
      metrics: (await host.qa.nlpRuntime.query({ sessionId: created.sessionId })).metrics,
      logZeilen: logZeilen(),
      inProzessEnqueued: getQaNlpMetrics().enqueued,
      inProzessQueueLength: getQaNlpMetrics().queueLength,
    };

    // Gegenprobe: ein echter Submit muss Metriken und Log verändern (Detektoren greifen)
    const gp = tn[0];
    await gp.trpc.qa.submit.mutate({
      sessionId: created.sessionId,
      participantId: gp.participantId,
      text: 'Gegenprobe: Wird die Folie zur Regression hochgeladen?',
      idempotencyKey: globalThis.crypto.randomUUID(),
    });
    await sleep(1500);
    const gegenprobe = {
      metricsCompletedDelta:
        (await host.qa.nlpRuntime.query({ sessionId: created.sessionId })).metrics.completed -
        nachher.metrics.completed,
      logZeilenDelta: logZeilen() - nachher.logZeilen,
    };

    // Feldvergleich
    const erwartet = (row: Json) => {
      const s = row.nlpStatus;
      return {
        state: {
          PENDING: 'pending',
          CLASSIFIED: 'classified',
          UNCERTAIN: 'uncertain',
          FAILED: 'failed',
          DISABLED: 'disabled',
        }[s as string],
        category: row.nlpCategory ? String(row.nlpCategory).toLowerCase() : null,
        confidence: row.nlpConfidence,
        modelVersion: row.nlpModelVersion,
        zeit: row.nlpAnalyzedAt,
      };
    };
    const ist = (nlp: Json) => ({
      state: nlp.state,
      category: nlp.category ?? nlp.candidateCategory ?? null,
      confidence: nlp.confidence?.value ?? null,
      modelVersion: nlp.modelVersion ?? null,
      zeit: nlp.classifiedAt ?? nlp.analyzedAt ?? null,
    });
    const dbById = new Map(vorher.db.map((r: Json) => [`qa-question:${r.id}`, r]));
    const vergleiche = (quelle: string, items: Json[]) =>
      items.map((q: Json) => {
        const row = dbById.get(q.sourceId) as Json;
        const e = erwartet(row);
        const i = ist(q.nlp);
        // Bei failed/disabled/pending trägt der Kontext keine Kategorie/Konfidenz/Version
        const relevant = ['classified', 'uncertain'].includes(e.state!)
          ? (['state', 'category', 'confidence', 'modelVersion', 'zeit'] as const)
          : (['state'] as const);
        const abweichungen = relevant.filter((k) => JSON.stringify(e[k]) !== JSON.stringify(i[k]));
        return {
          quelle,
          sourceId: q.sourceId,
          text: row.text,
          dbStatus: row.nlpStatus,
          kontextNlp: q.nlp,
          gleich: abweichungen.length === 0,
          abweichungen,
        };
      });
    const vollItems =
      analysis.context.questions.state === 'available' ? analysis.context.questions.items : [];
    const previewItems =
      previews[0].promptContext.context.questions.state === 'available'
        ? previews[0].promptContext.context.questions.items
        : [];
    const vergleich = [
      ...vergleiche('analyse-voll', vollItems),
      ...vergleiche('preview-gepackt', previewItems),
    ];

    const pruefungen = {
      dbUnveraendert: JSON.stringify(vorher.db) === JSON.stringify(nachher.db),
      pendingBleibtPending:
        nachher.db.find((r: Json) => r.id === fragenIds[0])?.nlpStatus === 'PENDING',
      backendMetrikenUnveraendert:
        JSON.stringify(vorher.metrics) === JSON.stringify(nachher.metrics),
      backendLogOhneNeueQaNlpZeilen: vorher.logZeilen === nachher.logZeilen,
      inProzessKeinEnqueue:
        vorher.inProzessEnqueued === 0 &&
        nachher.inProzessEnqueued === 0 &&
        nachher.inProzessQueueLength === 0,
      alleFragenImVollkontext: vollItems.length === TEXTE.length,
      kontextGleichDb: vergleich.every((v) => v.gleich),
      gegenprobeDetektorenGreifen:
        gegenprobe.metricsCompletedDelta === 1 && gegenprobe.logZeilenDelta >= 1,
      previewSnapshotStabil: new Set(previews.map((p) => p.promptContext.snapshotHash)).size === 1,
    };
    const ergebnis = {
      erzeugt: new Date().toISOString(),
      trpcUrl: TRPC_URL,
      session: { code: created.code, sessionId: created.sessionId },
      backendNlpEnabled: runtimeVorSeed.enabled,
      nachSubmitVorFixture: nachSubmit,
      fixtureEingriffe: [
        { frage: 1, id: fragenIds[0], gesetzt: 'PENDING (Felder leer)' },
        { frage: 2, id: fragenIds[1], gesetzt: 'FAILED stub:queue-limit' },
        { frage: 3, id: fragenIds[2], gesetzt: 'DISABLED' },
      ],
      vorher,
      nachher,
      kontextabrufe: {
        summaryContextPreviewHttp: previews.length,
        buildModerationPromptContextInProzess: 1,
      },
      previewSelectedMode: previews.map((p) => p.selectedMode),
      gegenprobe,
      vergleich,
      pruefungen,
      bestanden: Object.values(pruefungen).every(Boolean),
    };
    mkdirSync(path.dirname(path.resolve(ROOT, out)), { recursive: true });
    writeFileSync(path.resolve(ROOT, out), `${JSON.stringify(ergebnis, null, 2)}\n`);
    process.stdout.write(
      `Session ${created.code}: ${JSON.stringify(pruefungen)} · Vergleich ${vergleich.filter((v) => v.gleich).length}/${vergleich.length} gleich · bestanden ${ergebnis.bestanden}\n`,
    );
    if (!ergebnis.bestanden) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((error: unknown) => {
    process.stderr.write(
      `Kontextprüfung fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(1);
  });
