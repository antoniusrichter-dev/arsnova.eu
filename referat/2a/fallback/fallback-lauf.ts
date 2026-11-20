#!/usr/bin/env tsx
/**
 * Versuchscode Referat Thema 2 / Auftrag 2A, Schritt 3.3 – kein Produktpfad.
 *
 * Extraktiver Fallback im Releasepfad über die echte tRPC-API (nur Loopback).
 * Erwartete Backend-Flags: QA_SUMMARY_ENABLED=true, OPEN_WEIGHT_LLM_ENABLED=false,
 * QA_SUMMARY_INFERENCE_URL leer (für Störung a zusätzlich QA_SUMMARY_QUEUE_LIMIT=1).
 *
 * Eingaben sind die Seed-Ergebnisdateien (referat/evidenz/seed/pruefpunkt-*.json)
 * für die A–F-Zuordnung und die Token-Datei aus referat/.local/. Der Host-Token
 * wird nie ausgegeben; jede geschriebene Datei wird vorher auf den Token geprüft.
 *
 * Modi:
 *   haupt          --seed <json> --fall <name>
 *   queue-full     --seed <json> --seed <json> [--runden 5]
 *   source-changed --seed <json> --frage <A–F> --fall <name>
 * Ausgabe: referat/evidenz/2a/fallback/
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TRPCClient } from '@trpc/client';
import type { AppRouter } from '../../../apps/backend/src/routers';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../..');
const OUT_DIR = path.join(REPO_ROOT, 'referat/evidenz/2a/fallback');
const TRPC_URL = 'http://127.0.0.1:3000/trpc';

type SeedErgebnis = {
  fall: string;
  P: number;
  session: { code: string; sessionId: string };
  tokenDatei: string;
  fragen: Array<{ key: string; id: string; sourceId: string }>;
};
type Ctx = {
  seed: SeedErgebnis;
  token: string;
  client: TRPCClient<AppRouter>;
  keyById: Map<string, string>;
};

type ClientFactory = (url: string, hostToken?: string) => TRPCClient<AppRouter>;
let createHttpTrpcSingle: ClientFactory;
async function ladeClientFactory(): Promise<void> {
  ({ createHttpTrpcSingle } = (await import('../../../scripts/load/lib/trpc-runtime.mjs')) as {
    createHttpTrpcSingle: ClientFactory;
  });
}

function args(name: string): string[] {
  const out: string[] = [];
  const argv = process.argv;
  for (let i = 0; i < argv.length; i += 1)
    if (argv[i] === `--${name}` && argv[i + 1]) out.push(argv[i + 1]!);
  return out;
}

function ladeCtx(seedPfad: string): Ctx {
  const seed = JSON.parse(readFileSync(path.resolve(REPO_ROOT, seedPfad), 'utf8')) as SeedErgebnis;
  const token = (
    JSON.parse(readFileSync(path.resolve(REPO_ROOT, seed.tokenDatei), 'utf8')) as {
      hostToken: string;
    }
  ).hostToken;
  return {
    seed,
    token,
    client: createHttpTrpcSingle(TRPC_URL, token),
    keyById: new Map(seed.fragen.map((f) => [f.id, f.key])),
  };
}

const tokens: string[] = [];
function schreibe(name: string, value: unknown): string {
  const json = `${JSON.stringify(value, null, 2)}\n`;
  for (const t of tokens)
    if (t && json.includes(t)) throw new Error(`Token in ${name} gefunden – nicht geschrieben.`);
  mkdirSync(OUT_DIR, { recursive: true });
  const p = path.join(OUT_DIR, name);
  writeFileSync(p, json);
  return path.relative(REPO_ROOT, p);
}

/** Alle qa-question-IDs im Ergebnis, aufgelöst gegen die geseedeten Fragen. */
function quellen(ctx: Ctx, value: unknown) {
  const ids = new Set<string>();
  const re = /qa-question:([0-9a-f-]{36})/g;
  for (const m of JSON.stringify(value).matchAll(re)) ids.add(m[1]!);
  const liste = [...ids].map((id) => ({ id, key: ctx.keyById.get(id) ?? null }));
  return { anzahl: liste.length, aufgeloest: liste.filter((q) => q.key).length, liste };
}

type Runtime = Awaited<ReturnType<TRPCClient<AppRouter>['qa']['summaryRuntime']['query']>>;

function kurz(rt: Runtime) {
  const r = rt.result as {
    status?: string;
    execution?: {
      attemptedMode?: string | null;
      effectiveMode?: string | null;
      fallback?: { reason?: string } | null;
    };
    modelVersion?: string;
    statements?: unknown[];
    snapshotHash?: string;
  } | null;
  return {
    enabled: rt.enabled,
    inferenceConfigured: rt.inferenceConfigured,
    status: r?.status ?? null,
    attemptedMode: r?.execution?.attemptedMode ?? null,
    effectiveMode: r?.execution?.effectiveMode ?? null,
    fallbackReason: r?.execution?.fallback?.reason ?? null,
    modelVersion: r?.modelVersion ?? null,
    statements: Array.isArray(r?.statements) ? r.statements.length : null,
    snapshotHash: r?.snapshotHash ?? null,
  };
}

async function warteFertig(
  ctx: Ctx,
  maxMs = 30_000,
): Promise<{ rt: Runtime; polls: number; ms: number }> {
  const t0 = Date.now();
  let polls = 0;
  for (;;) {
    const rt = await ctx.client.qa.summaryRuntime.query({ sessionId: ctx.seed.session.sessionId });
    polls += 1;
    if (rt.result?.status !== 'pending' || Date.now() - t0 > maxMs)
      return { rt, polls, ms: Date.now() - t0 };
    await new Promise((r) => setTimeout(r, 100));
  }
}

async function haupt(): Promise<void> {
  const ctx = ladeCtx(args('seed')[0]!);
  tokens.push(ctx.token);
  const fall = args('fall')[0] ?? ctx.seed.fall;
  const sessionId = ctx.seed.session.sessionId;
  const vorher = await ctx.client.qa.summaryRuntime.query({ sessionId });
  const vorschau = await ctx.client.qa.summaryContextPreview.query({ sessionId, locale: 'de' });
  const t0 = Date.now();
  const anfrage = await ctx.client.qa.requestSummary.mutate({ sessionId, locale: 'de' });
  const msAnfrage = Date.now() - t0;
  const { rt, polls, ms } = await warteFertig(ctx);
  const q = quellen(ctx, rt.result);
  const ergebnis = {
    schritt: '3.3',
    fall,
    P: ctx.seed.P,
    session: ctx.seed.session,
    erzeugt: new Date().toISOString(),
    aufrufe: [
      'qa.summaryRuntime',
      'qa.summaryContextPreview(locale=de)',
      'qa.requestSummary(locale=de)',
      `qa.summaryRuntime ×${polls}`,
    ],
    latenz: { requestSummaryMs: msAnfrage, bisFertigMs: ms },
    kurz: { vorher: kurz(vorher), anfrage: kurz(anfrage), final: kurz(rt) },
    quellen: q,
    quellenVorschau: quellen(ctx, vorschau),
    antwortSummaryContextPreview: vorschau,
    antwortRequestSummary: anfrage,
    antwortSummaryRuntime: rt,
  };
  const datei = schreibe(`${fall}-haupt.json`, ergebnis);
  console.log(
    JSON.stringify({
      fall,
      datei,
      ...ergebnis.kurz.final,
      quellen: `${q.aufgeloest}/${q.anzahl}`,
      keys: q.liste.map((x) => x.key),
    }),
  );
}

async function queueFull(): Promise<void> {
  const ctxs = args('seed').map(ladeCtx);
  if (ctxs.length !== 2) throw new Error('queue-full braucht genau zwei --seed.');
  ctxs.forEach((c) => tokens.push(c.token));
  const runden = Number(args('runden')[0] ?? 5);
  const protokoll = [];
  for (let r = 1; r <= runden; r += 1) {
    const t0 = Date.now();
    const antworten = await Promise.all(
      ctxs.map(async (c) => {
        const a = await c.client.qa.requestSummary.mutate({
          sessionId: c.seed.session.sessionId,
          locale: 'de',
        });
        return { fall: c.seed.fall, ms: Date.now() - t0, antwort: a };
      }),
    );
    const finals = await Promise.all(ctxs.map((c) => warteFertig(c)));
    protokoll.push({
      runde: r,
      anfragen: antworten.map((a) => ({ fall: a.fall, ms: a.ms, ...kurz(a.antwort) })),
      final: finals.map((f, i) => ({ fall: ctxs[i]!.seed.fall, ...kurz(f.rt) })),
      antworten: antworten.map((a) => ({ fall: a.fall, antwort: a.antwort })),
    });
    console.log(
      `Runde ${r}: ` +
        antworten
          .map(
            (a) => `${a.fall} → ${kurz(a.antwort).status}/${kurz(a.antwort).fallbackReason ?? '–'}`,
          )
          .join(' · '),
    );
    await new Promise((res) => setTimeout(res, 300));
  }
  const queueFullRunden = protokoll.filter((p) =>
    p.anfragen.some((a) => a.fallbackReason === 'queue_full'),
  ).length;
  const datei = schreibe('stoerung-a-queue-full.json', {
    schritt: '3.3 Störung a',
    erzeugt: new Date().toISOString(),
    erwartet: 'queue_full bei zwei schnellen Anfragen (zwei Sessions, QA_SUMMARY_QUEUE_LIMIT=1)',
    sessions: ctxs.map((c) => ({ fall: c.seed.fall, ...c.seed.session })),
    runden,
    queueFullRunden,
    protokoll,
  });
  console.log(JSON.stringify({ datei, runden, queueFullRunden }));
}

async function sourceChanged(): Promise<void> {
  const ctx = ladeCtx(args('seed')[0]!);
  tokens.push(ctx.token);
  const key = args('frage')[0] ?? 'F';
  const fall = args('fall')[0] ?? ctx.seed.fall;
  const frage = ctx.seed.fragen.find((f) => f.key === key)!;
  const sessionId = ctx.seed.session.sessionId;
  // --loeschung parallel: Anfrage und Löschung gleichzeitig abschicken.
  // --loeschung nach-pending: löschen, sobald requestSummary mit status=pending antwortet.
  const variante = args('loeschung')[0] ?? 'nach-pending';
  const vorher = await ctx.client.qa.summaryRuntime.query({ sessionId });
  const fehlertext = (e: unknown) => {
    const m = e instanceof Error ? e.message : String(e);
    return tokens.reduce((acc, t) => (t ? acc.split(t).join('***') : acc), m);
  };
  const loesche = () =>
    ctx.client.qa.moderate
      .mutate({ sessionCode: ctx.seed.session.code, questionId: frage.id, action: 'DELETE' })
      .then((d) => ({ ok: true as const, status: d.status, ms: Date.now() - t0 }))
      .catch((e: unknown) => ({ ok: false as const, fehler: fehlertext(e), ms: Date.now() - t0 }));
  const frage_an = () =>
    ctx.client.qa.requestSummary
      .mutate({ sessionId, locale: 'de' })
      .then((a) => ({ ok: true as const, a, ms: Date.now() - t0 }))
      .catch((e: unknown) => ({ ok: false as const, fehler: fehlertext(e), ms: Date.now() - t0 }));
  const t0 = Date.now();
  let anfrage: Awaited<ReturnType<typeof frage_an>>;
  let loeschung: Awaited<ReturnType<typeof loesche>> | null = null;
  if (variante === 'parallel') {
    [anfrage, loeschung] = await Promise.all([frage_an(), loesche()]);
  } else {
    anfrage = await frage_an();
    if (anfrage.ok && anfrage.a.result?.status === 'pending') loeschung = await loesche();
  }
  const { rt, polls, ms } = await warteFertig(ctx);
  const q = quellen(ctx, rt.result);
  const ergebnis = {
    schritt: '3.3 Störung b',
    fall,
    variante,
    erzeugt: new Date().toISOString(),
    erwartet: 'source_changed, wenn die Frage während pending gelöscht wird',
    geloeschteFrage: { key, id: frage.id },
    loeschung,
    anfrage: anfrage.ok
      ? { ok: true, msNachStart: anfrage.ms, ...kurz(anfrage.a) }
      : { ok: false, msNachStart: anfrage.ms, fehler: anfrage.fehler },
    kurz: { vorher: kurz(vorher), final: kurz(rt) },
    pollsBisFertig: polls,
    msBisFertig: ms,
    quellen: q,
    geloeschteFrageInQuellen: q.liste.some((x) => x.id === frage.id),
    antwortRequestSummary: anfrage.ok ? anfrage.a : null,
    antwortSummaryRuntime: rt,
  };
  const datei = schreibe(`stoerung-b-source-changed-${fall}-${variante}-${key}.json`, ergebnis);
  console.log(
    JSON.stringify({
      datei,
      variante,
      anfrage: ergebnis.anfrage,
      loeschung,
      final: ergebnis.kurz.final,
      geloeschteFrageInQuellen: ergebnis.geloeschteFrageInQuellen,
    }),
  );
}

const modus = process.argv[2];
const run =
  modus === 'haupt'
    ? haupt
    : modus === 'queue-full'
      ? queueFull
      : modus === 'source-changed'
        ? sourceChanged
        : null;
if (!run) {
  console.error('Modus: haupt | queue-full | source-changed');
  process.exit(2);
}
ladeClientFactory()
  .then(run)
  .catch((e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`Fehler: ${tokens.reduce((m, t) => (t ? m.split(t).join('***') : m), msg)}`);
    process.exit(1);
  });
