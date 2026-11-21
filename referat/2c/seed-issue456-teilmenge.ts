/**
 * VERSUCHSCODE (Referat 2C, Fall d) – kein Produktpfad.
 *
 * Große Q&A-Session aus einer Teilmenge des Issue-#456-Korpus
 * (`scripts/load/lib/issue-456-demo-qa-corpus.mjs`, `buildIssue456ParticipantQuestions`).
 * Der Lasttest selbst verlangt ≥ 250 Teilnehmende und ein komplettes Demo-Quiz; hier nur
 * der Q&A-Teil für N Teilnehmende × 10 Fragen, damit der Summary-Pfad den Großkorpus-Zweig
 * (≥ 100 Fragen → 16 Kandidaten) und das Tokenbudget erreicht.
 *
 * Vorgehen wie `referat/fixtures/seed-sechs-fragen.ts`: Session über die echte API
 * (`session.create`), Teilnehmende/Fragen/Stimmen als echte Zeilen (Zähler nur per Trigger),
 * alle Fragen ACTIVE, keine Eigenbewertung. Stimmen deterministisch (mulberry32, Seed 0x456).
 * Kein Lernziel (Q&A-only-Session; das Lernziel des Lasttests ist quiz-weit).
 *
 * Aufruf aus dem Repo-Root:
 *   npx tsx referat/2c/seed-issue456-teilmenge.ts --teilnehmende 30 --out referat/evidenz/2c/seed/d.json
 * Host-Token nur in referat/.local/host-<CODE>.json (gitignored), nie in --out.
 */
import { randomUUID } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import type { TRPCClient } from '@trpc/client';
import type { AppRouter } from '../../apps/backend/src/routers';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../..');
const LOCAL_DIR = path.join(REPO_ROOT, 'referat/.local');
const SEED_MARK = 'Referat T2G8';
const TRPC_URL = 'http://127.0.0.1:3000/trpc';

function value(argv: string[], name: string): string | null {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? (argv[i + 1] ?? null) : null;
}

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

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const n = Number(value(argv, 'teilnehmende') ?? '30');
  const out = value(argv, 'out');
  if (!Number.isInteger(n) || n < 11) throw new Error('--teilnehmende ≥ 11 (≥ 100 Fragen)');

  const { buildIssue456ParticipantQuestions } =
    (await import('../../scripts/load/lib/issue-456-demo-qa-corpus.mjs')) as {
      buildIssue456ParticipantQuestions: (
        i: number,
      ) => Array<{ participantIndex: number; questionIndex: number; scope: string; text: string }>;
    };
  const corpus = Array.from({ length: n }, (_, i) => buildIssue456ParticipantQuestions(i)).flat();

  dotenv.config({ path: path.join(REPO_ROOT, '.env'), quiet: true });
  const { prisma } = await import('../../apps/backend/src/db');
  const { createHttpTrpcSingle } = (await import('../../scripts/load/lib/trpc-runtime.mjs')) as {
    createHttpTrpcSingle: (url: string, hostToken?: string) => TRPCClient<AppRouter>;
  };

  try {
    const created = await createHttpTrpcSingle(TRPC_URL).session.create.mutate({
      type: 'Q_AND_A',
      title: `${SEED_MARK} · #456-Teilmenge · ${n} TN`,
      moderationMode: false,
      qaModerationMode: false,
      quickFeedbackEnabled: false,
      allowCustomNicknames: true,
      nicknameTheme: 'HIGH_SCHOOL',
      anonymousMode: false,
      teamMode: false,
    });
    const { code, sessionId } = created;
    mkdirSync(LOCAL_DIR, { recursive: true });
    if (!existsSync(path.join(LOCAL_DIR, '.gitignore'))) {
      writeFileSync(path.join(LOCAL_DIR, '.gitignore'), '*\n');
    }
    const tokenDatei = path.join(LOCAL_DIR, `host-${code}.json`);
    writeFileSync(
      tokenDatei,
      `${JSON.stringify({ code, sessionId, hostToken: created.hostToken }, null, 2)}\n`,
      { mode: 0o600 },
    );
    chmodSync(tokenDatei, 0o600);

    const participants = Array.from({ length: n }, (_, i) => ({
      id: randomUUID(),
      sessionId,
      nickname: `${SEED_MARK} TN ${String(i + 1).padStart(4, '0')}`,
    }));
    const rnd = mulberry32(0x456);
    const t0 = Date.now();
    const questionRows = corpus.map((row, index) => ({
      id: randomUUID(),
      sessionId,
      participantId: participants[row.participantIndex]!.id,
      text: row.text,
      status: 'ACTIVE' as const,
      createdAt: new Date(t0 - (corpus.length - index) * 1_000),
    }));
    const voteRows: Array<{
      id: string;
      qaQuestionId: string;
      participantId: string;
      direction: 'UP' | 'DOWN';
    }> = [];
    for (const q of questionRows) {
      const voters = participants.filter((p) => p.id !== q.participantId);
      const total = Math.floor(rnd() * voters.length);
      const downShare = rnd() < 0.2 ? 0.5 : rnd() * 0.25;
      const down = Math.round(total * downShare);
      voters.slice(0, total).forEach((p, i) =>
        voteRows.push({
          id: randomUUID(),
          qaQuestionId: q.id,
          participantId: p.id,
          direction: i < down ? 'DOWN' : 'UP',
        }),
      );
    }

    await prisma.$transaction(
      async (tx) => {
        await tx.participant.createMany({ data: participants });
        await tx.qaQuestion.createMany({ data: questionRows });
        for (let i = 0; i < voteRows.length; i += 1000) {
          await tx.qaUpvote.createMany({ data: voteRows.slice(i, i + 1000) });
        }
      },
      { timeout: 120_000 },
    );

    const fragen = await prisma.qaQuestion.count({ where: { sessionId, status: 'ACTIVE' } });
    const stimmen = await prisma.qaUpvote.count({ where: { qaQuestion: { sessionId } } });
    const ergebnis = {
      fall: 'd-issue456-teilmenge',
      korpus: 'scripts/load/lib/issue-456-demo-qa-corpus.mjs (buildIssue456ParticipantQuestions)',
      teilnehmende: n,
      fragenSoll: corpus.length,
      fragenIst: fragen,
      eindeutigeTexte: new Set(corpus.map((r) => r.text)).size,
      stimmZeilen: stimmen,
      stimmSeed: '0x456',
      erzeugt: new Date().toISOString(),
      trpcUrl: TRPC_URL,
      session: { code, sessionId, typ: 'Q_AND_A', qaModerationMode: false },
      tokenDatei: path.relative(REPO_ROOT, tokenDatei),
      lernziel: null,
      // Für die Zuordnung in der Auswertung: sourceId → Korpuszeile
      fragen: questionRows.map((q, i) => ({
        sourceId: `qa-question:${q.id}`,
        teilnehmer: corpus[i]!.participantIndex,
        scope: corpus[i]!.scope,
        text: q.text,
      })),
      pruefung: fragen === corpus.length ? 'ok' : 'fehler',
    };
    if (out) {
      mkdirSync(path.dirname(path.resolve(REPO_ROOT, out)), { recursive: true });
      writeFileSync(path.resolve(REPO_ROOT, out), `${JSON.stringify(ergebnis, null, 2)}\n`);
    }
    process.stdout.write(
      `Session ${code} · ${n} TN · Fragen ${fragen}/${corpus.length} (eindeutig ${ergebnis.eindeutigeTexte}) · Stimmen ${stimmen} · Prüfung ${ergebnis.pruefung}\n`,
    );
    if (ergebnis.pruefung !== 'ok') process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(
    `Seed fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
