#!/usr/bin/env tsx
/**
 * Seed „Sechs-Fragen-Szenario“ (Issue #456 §12) gegen das lokale Labor –
 * Referat Thema 2, Gruppe 8, Runbook Schritt 2.2. Kein Produktpfad.
 *
 * Ablauf (an seed:qa-forum / seed:moderation-compass angelehnt):
 *   1. Q&A-Session über die echte API anlegen (session.create, nur Loopback).
 *      Der Host-Token kommt damit vom Produkt und landet nur in einer
 *      Token-Datei (Modus 0600, Verzeichnis per .gitignore ausgeschlossen),
 *      nie auf stdout oder in der Ergebnisdatei.
 *   2. Optional: bestätigtes Lernziel über session.saveLearningObjectives.
 *   3. P Teilnehmende, die sechs Fragen A–F (ACTIVE) und echte QaUpvote-Zeilen
 *      direkt per Prisma schreiben (wie die Produkt-Seeds). Die Zähler
 *      positive/negativeVoteCount setzt allein der DB-Trigger
 *      `QaUpvote_reconcile_counts`; das Skript setzt keine Zähler selbst.
 *   4. Rücklesen und prüfen: Teilnehmerzahl = P, 6 Fragen, Zähler = Sollwerte.
 *
 * Jede Stimme stammt von einer eigenen teilnehmenden Person, die nicht Autor:in
 * der Frage ist. Pro Frage sind daher höchstens P − 1 Stimmen möglich. Die
 * Fixture braucht 110 Stimmen auf A und ist erst ab P ≥ 111 realisierbar.
 * Kleinere P sind nur mit --skaliert erlaubt: alle Stimmen werden mit
 *   f = ⌊10 · (P − 1) / maxStimmen⌋ / 10
 * multipliziert und kaufmännisch gerundet (P = 50: f = 0,4 → Fall „P50-skaliert“).
 *
 * Aufruf (Backend muss laufen, z. B. npm run dev:backend):
 *   npx tsx referat/fixtures/seed-sechs-fragen.ts --p 200
 *   npx tsx referat/fixtures/seed-sechs-fragen.ts --p 500 --lernziel
 *   npx tsx referat/fixtures/seed-sechs-fragen.ts --p 50 --skaliert --out referat/evidenz/2a/seed-p50-skaliert.json
 *
 * Optionen:
 *   --p <N>             Raumgröße (Teilnehmende in der Session), Pflicht
 *   --skaliert          Stimmen proportional verkleinern, falls P zu klein ist
 *   --lernziel          bestätigtes Lernziel aus der Fixture anlegen
 *   --trpc-url <URL>    Default http://127.0.0.1:3000/trpc (nur 127.0.0.1/localhost)
 *   --token-datei <P>   Default referat/.local/host-<CODE>.json
 *   --out <Pfad>        Ergebnis (ohne Token) zusätzlich als JSON schreiben
 *   --dry-run           nur Sollwerte berechnen und ausgeben, nichts schreiben
 */
import { randomUUID } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import type { TRPCClient } from '@trpc/client';
import type { AppRouter } from '../../apps/backend/src/routers';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../..');
const FIXTURE_PATH = path.join(HERE, 'sechs-fragen-szenario.json');
const LOCAL_DIR = path.join(REPO_ROOT, 'referat/.local');
const SEED_MARK = 'Referat T2G8';

type FixtureFrage = {
  key: string;
  sourceId: string;
  paar: string;
  thema: string;
  text: string;
  status: 'ACTIVE';
  positive: number;
  negative: number;
};
type Fixture = {
  fixtureId: string;
  raumgroessen: number[];
  lernziel: { optional: boolean; status: 'confirmed'; text: string };
  fragen: FixtureFrage[];
};

type Options = {
  p: number;
  skaliert: boolean;
  lernziel: boolean;
  trpcUrl: string;
  tokenDatei: string | null;
  out: string | null;
  dryRun: boolean;
};

export type SollFrage = {
  key: string;
  text: string;
  positiveFixture: number;
  negativeFixture: number;
  positive: number;
  negative: number;
};

function log(line = ''): void {
  process.stdout.write(`${line}\n`);
}

function parseArgs(argv: string[]): Options {
  const value = (name: string): string | null => {
    const i = argv.indexOf(`--${name}`);
    if (i < 0) return null;
    const v = argv[i + 1];
    if (!v || v.startsWith('--')) throw new Error(`--${name} braucht einen Wert.`);
    return v;
  };
  const flag = (name: string) => argv.includes(`--${name}`);
  const pRaw = value('p');
  const p = Number(pRaw);
  if (!pRaw || !Number.isInteger(p) || p < 2) {
    throw new Error('--p <N> (ganze Zahl ≥ 2) ist Pflicht.');
  }
  return {
    p,
    skaliert: flag('skaliert'),
    lernziel: flag('lernziel'),
    trpcUrl: value('trpc-url') ?? 'http://127.0.0.1:3000/trpc',
    tokenDatei: value('token-datei'),
    out: value('out'),
    dryRun: flag('dry-run'),
  };
}

function assertLoopback(url: string): void {
  const host = new URL(url).hostname;
  if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(host)) {
    throw new Error(`Nur Loopback-Ziele erlaubt, nicht ${host}.`);
  }
}

export function loadFixture(): Fixture {
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as Fixture;
}

/** Sollstimmen je Frage für Raumgröße P (Autor:in stimmt nicht über die eigene Frage ab). */
export function planStimmen(
  fixture: Fixture,
  p: number,
  skaliert: boolean,
): { faktor: number; fall: string; fragen: SollFrage[] } {
  const maxStimmen = Math.max(...fixture.fragen.map((q) => q.positive + q.negative));
  const verfuegbar = p - 1;
  let faktor = 1;
  if (maxStimmen > verfuegbar) {
    if (!skaliert) {
      throw new Error(
        `P = ${p} reicht nicht: Frage mit ${maxStimmen} Stimmen braucht mindestens ${maxStimmen + 1} Teilnehmende. ` +
          'Mit --skaliert werden die Stimmen proportional verkleinert.',
      );
    }
    faktor = Math.floor((10 * verfuegbar) / maxStimmen) / 10;
  }
  return {
    faktor,
    fall: faktor === 1 ? `P${p}` : `P${p}-skaliert`,
    fragen: fixture.fragen.map((q) => ({
      key: q.key,
      text: q.text,
      positiveFixture: q.positive,
      negativeFixture: q.negative,
      positive: Math.round(q.positive * faktor),
      negative: Math.round(q.negative * faktor),
    })),
  };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  assertLoopback(options.trpcUrl);
  const fixture = loadFixture();
  const plan = planStimmen(fixture, options.p, options.skaliert);

  log(
    `Fixture ${fixture.fixtureId} · Fall ${plan.fall} · P = ${options.p} · Faktor ${plan.faktor}`,
  );
  for (const q of plan.fragen) {
    log(
      `  ${q.key}: ${q.positive}/${q.negative} (Fixture ${q.positiveFixture}/${q.negativeFixture})`,
    );
  }
  if (options.dryRun) {
    log('Dry run: nichts geschrieben.');
    return;
  }

  // .env nur für DATABASE_URL des Prisma-Clients laden; nichts davon wird ausgegeben.
  dotenv.config({ path: path.join(REPO_ROOT, '.env'), quiet: true });
  const { prisma } = await import('../../apps/backend/src/db');
  const { createHttpTrpcSingle } = (await import('../../scripts/load/lib/trpc-runtime.mjs')) as {
    createHttpTrpcSingle: (url: string, hostToken?: string) => TRPCClient<AppRouter>;
  };

  try {
    // 1. Session über die echte API
    const publicTrpc = createHttpTrpcSingle(options.trpcUrl);
    const created = await publicTrpc.session.create.mutate({
      type: 'Q_AND_A',
      title: `${SEED_MARK} · Sechs-Fragen · ${plan.fall}${options.lernziel ? ' · Lernziel' : ''}`,
      moderationMode: false,
      qaModerationMode: false,
      quickFeedbackEnabled: false,
      allowCustomNicknames: true,
      nicknameTheme: 'HIGH_SCHOOL',
      anonymousMode: false,
      teamMode: false,
    });
    const code: string = created.code;
    const sessionId: string = created.sessionId;
    const tokenDatei = options.tokenDatei
      ? path.resolve(REPO_ROOT, options.tokenDatei)
      : path.join(LOCAL_DIR, `host-${code}.json`);
    mkdirSync(path.dirname(tokenDatei), { recursive: true });
    if (path.dirname(tokenDatei) === LOCAL_DIR && !existsSync(path.join(LOCAL_DIR, '.gitignore'))) {
      writeFileSync(path.join(LOCAL_DIR, '.gitignore'), '*\n');
    }
    writeFileSync(
      tokenDatei,
      `${JSON.stringify({ code, sessionId, hostToken: created.hostToken }, null, 2)}\n`,
      { mode: 0o600 },
    );
    chmodSync(tokenDatei, 0o600);
    const hostTrpc = createHttpTrpcSingle(options.trpcUrl, created.hostToken);

    // 2. Optionales bestätigtes Lernziel
    let lernziel: { objectiveId: string; text: string; confirmationState: string } | null = null;
    if (options.lernziel) {
      const before = await hostTrpc.session.getLearningObjectives.query({ code });
      const objectiveId = randomUUID();
      const saved = await hostTrpc.session.saveLearningObjectives.mutate({
        code,
        expectedLearningContextRevision: before.learningContextRevision,
        mutations: [
          {
            action: 'upsert',
            objectiveId,
            expectedRevision: null,
            text: fixture.lernziel.text,
            scope: { kind: 'session' },
            confirmationState: 'confirmed',
          },
        ],
      });
      const row = (
        saved.objectives as Array<{ id: string; text: string; confirmation: { state: string } }>
      ).find((o) => o.id === objectiveId);
      if (!row) throw new Error('Lernziel wurde nicht gespeichert.');
      if (row.confirmation.state !== 'confirmed') {
        throw new Error(`Lernziel hat Status ${row.confirmation.state}, erwartet confirmed.`);
      }
      lernziel = { objectiveId, text: row.text, confirmationState: row.confirmation.state };
    }

    // 3. Teilnehmende, Fragen, Stimmen
    const participants = Array.from({ length: options.p }, (_, i) => ({
      id: randomUUID(),
      sessionId,
      nickname: `${SEED_MARK} TN ${String(i + 1).padStart(4, '0')}`,
    }));
    const participantIds = participants.map((x) => x.id);
    const t0 = Date.now();
    const fragenIds = new Map<string, string>();
    const voteRows: Array<{
      id: string;
      qaQuestionId: string;
      participantId: string;
      direction: 'UP' | 'DOWN';
    }> = [];
    const questionRows = plan.fragen.map((q, index) => {
      const id = randomUUID();
      fragenIds.set(q.key, id);
      const authorId = participantIds[index]!;
      const voters = participantIds.filter((pid) => pid !== authorId);
      voters
        .slice(0, q.positive)
        .forEach((participantId) =>
          voteRows.push({ id: randomUUID(), qaQuestionId: id, participantId, direction: 'UP' }),
        );
      voters
        .slice(q.positive, q.positive + q.negative)
        .forEach((participantId) =>
          voteRows.push({ id: randomUUID(), qaQuestionId: id, participantId, direction: 'DOWN' }),
        );
      return {
        id,
        sessionId,
        participantId: authorId,
        text: fixture.fragen[index]!.text,
        status: 'ACTIVE' as const,
        createdAt: new Date(t0 - (plan.fragen.length - index) * 60_000),
      };
    });

    await prisma.$transaction(
      async (tx) => {
        for (let i = 0; i < participants.length; i += 1000) {
          await tx.participant.createMany({ data: participants.slice(i, i + 1000) });
        }
        await tx.qaQuestion.createMany({ data: questionRows });
        for (let i = 0; i < voteRows.length; i += 1000) {
          await tx.qaUpvote.createMany({ data: voteRows.slice(i, i + 1000) });
        }
      },
      { timeout: 120_000 },
    );

    // 4. Rücklesen und prüfen
    const participantCount = await prisma.participant.count({ where: { sessionId } });
    const rows = await prisma.qaQuestion.findMany({
      where: { sessionId },
      select: {
        id: true,
        status: true,
        positiveVoteCount: true,
        negativeVoteCount: true,
        upvoteCount: true,
      },
    });
    const voteCount = await prisma.qaUpvote.count({ where: { qaQuestion: { sessionId } } });
    const fehler: string[] = [];
    if (participantCount !== options.p)
      fehler.push(`Teilnehmende ${participantCount} ≠ P ${options.p}`);
    if (rows.length !== 6) fehler.push(`Fragen ${rows.length} ≠ 6`);
    const fragen = plan.fragen.map((q) => {
      const id = fragenIds.get(q.key)!;
      const row = rows.find((r) => r.id === id);
      const ist = row
        ? {
            status: row.status,
            positive: row.positiveVoteCount,
            negative: row.negativeVoteCount,
            upvoteCount: row.upvoteCount,
          }
        : null;
      if (
        !ist ||
        ist.status !== 'ACTIVE' ||
        ist.positive !== q.positive ||
        ist.negative !== q.negative
      ) {
        fehler.push(
          `${q.key}: Soll ${q.positive}/${q.negative}, Ist ${ist ? `${ist.positive}/${ist.negative} ${ist.status}` : 'fehlt'}`,
        );
      }
      return {
        key: q.key,
        id,
        sourceId: `qa-question:${id}`,
        soll: { positive: q.positive, negative: q.negative },
        ist,
      };
    });

    const ergebnis = {
      fixtureId: fixture.fixtureId,
      fall: plan.fall,
      P: options.p,
      faktor: plan.faktor,
      erzeugt: new Date().toISOString(),
      trpcUrl: options.trpcUrl,
      session: { code, sessionId, typ: 'Q_AND_A', qaModerationMode: false },
      tokenDatei: path.relative(REPO_ROOT, tokenDatei),
      lernziel,
      teilnehmende: participantCount,
      stimmZeilen: voteCount,
      fragen,
      pruefung: fehler.length === 0 ? 'ok' : 'fehler',
      fehler,
    };
    if (options.out) {
      const outPath = path.resolve(REPO_ROOT, options.out);
      mkdirSync(path.dirname(outPath), { recursive: true });
      writeFileSync(outPath, `${JSON.stringify(ergebnis, null, 2)}\n`);
    }
    log(
      `Session ${code} (${sessionId}) · Teilnehmende ${participantCount} · Stimm-Zeilen ${voteCount}`,
    );
    log(`Lernziel: ${lernziel ? `${lernziel.confirmationState} – ${lernziel.text}` : '—'}`);
    for (const f of fragen) {
      log(
        `  ${f.key} ${f.sourceId}: Ist ${f.ist?.positive}/${f.ist?.negative} ${f.ist?.status} (Soll ${f.soll.positive}/${f.soll.negative})`,
      );
    }
    log(`Host-Token: in ${path.relative(REPO_ROOT, tokenDatei)} (nicht ausgegeben)`);
    log(`Prüfung: ${ergebnis.pruefung}${fehler.length ? ` – ${fehler.join('; ')}` : ''}`);
    if (fehler.length) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    process.stderr.write(
      `Seed fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(1);
  });
}
