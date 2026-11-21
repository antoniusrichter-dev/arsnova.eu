/**
 * ============================================================================
 * VERSUCHSCODE – KEIN PRODUKTPFAD (Referat Thema 2, Auftrag 2B, Schritt 4.3)
 * ============================================================================
 * Burst: 200 × qa.submit gleichzeitig gegen eine frische Q&A-Session (20 Teilnehmende ×
 * 10 Fragen = QA_MAX_QUESTIONS_PER_PARTICIPANT). Fragetexte zyklisch aus
 * referat/2b/referenz.csv.
 *
 * Gemessen je Lauf:
 *   - Latenz jedes Submits (Client, p50/p95/max) und Dauer des Bursts
 *   - qa.nlpRuntime.metrics (Host) vor dem Burst, direkt nach der letzten Submit-Antwort und
 *     im Verlauf bis zum Leerlauf (Deltas, weil die Zähler prozessweit kumulieren)
 *   - nlpStatus der Session-Fragen in der DB direkt nach der letzten Submit-Antwort und am Ende
 *     (Nachweis, dass submit nicht auf die Klassifikation wartet)
 *   - RSS des Backend-Prozesses (/proc/<pid>/status, 100 ms)
 * Log-Auswertung (qa_nlp:completed/skipped) übernimmt referat/2b/burst-auswertung.ts.
 *
 * Host-Token und Teilnehmer-Capabilities bleiben im Speicher und werden nie geschrieben.
 * Nur Loopback-Ziel.
 *
 * Aufruf aus Repo-Root:
 *   npx tsx referat/2b/burst.ts --pid <backend-pid> --konfig <name> --lauf <n> --out <datei.json>
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import dotenv from 'dotenv';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const TRPC_URL = 'http://127.0.0.1:3000/trpc';
const TEILNEHMENDE = 20;
const FRAGEN_JE_TN = 10;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

function arg(name: string): string {
  const i = process.argv.indexOf(name);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  if (!v) throw new Error(`${name} fehlt`);
  return v;
}

function perzentil(values: number[], p: number): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)] ?? 0;
}
const zusammenfassen = (v: number[]) => ({
  n: v.length,
  p50Ms: Number(perzentil(v, 50).toFixed(1)),
  p95Ms: Number(perzentil(v, 95).toFixed(1)),
  maxMs: Number(Math.max(0, ...v).toFixed(1)),
});

function rssKb(pid: string): { vmRssKb: number; rssAnonKb: number } | null {
  try {
    const s = readFileSync(`/proc/${pid}/status`, 'utf8');
    const get = (k: string) => Number(new RegExp(`^${k}:\\s+(\\d+)`, 'mu').exec(s)?.[1] ?? NaN);
    return { vmRssKb: get('VmRSS'), rssAnonKb: get('RssAnon') };
  } catch {
    return null;
  }
}

/** Fragetexte aus der Referenzmenge (zweite Spalte, RFC-4180-tolerant genug für diese Datei). */
function referenzTexte(): string[] {
  const src = readFileSync(path.join(ROOT, 'referat/2b/referenz.csv'), 'utf8');
  const texte: string[] = [];
  const re = /^R\d+,("(?:[^"]|"")*"|[^,]*),/gmu;
  for (const m of src.matchAll(re)) {
    const raw = m[1]!;
    texte.push(raw.startsWith('"') ? raw.slice(1, -1).replaceAll('""', '"') : raw);
  }
  if (texte.length < 50) throw new Error(`Referenztexte unvollständig (${texte.length})`);
  return texte;
}

async function main(): Promise<void> {
  const pid = arg('--pid');
  const konfig = arg('--konfig');
  const lauf = Number(arg('--lauf'));
  const out = arg('--out');
  dotenv.config({ path: path.join(ROOT, '.env'), quiet: true });
  const { prisma } = await import('../../apps/backend/src/db');
  const { createHttpTrpcSingle } =
    (await import('../../scripts/load/lib/trpc-runtime.mjs')) as Json;
  const { configureQaSessionIfNeeded } =
    (await import('../../scripts/load/lib/configure-qa-if-needed.mjs')) as Json;

  const rss: Array<{ tMs: number; vmRssKb: number; rssAnonKb: number }> = [];
  const t0 = performance.now();
  const sampler = setInterval(() => {
    const r = rssKb(pid);
    if (r) rss.push({ tMs: Math.round(performance.now() - t0), ...r });
  }, 100);

  try {
    const pub = createHttpTrpcSingle(TRPC_URL);
    const created = await pub.session.create.mutate({
      type: 'Q_AND_A',
      title: `Referat T2G8 · 2B Burst · ${konfig} · Lauf ${lauf}`,
      moderationMode: false,
      qaModerationMode: false,
      quickFeedbackEnabled: false,
      allowCustomNicknames: true,
      nicknameTheme: 'HIGH_SCHOOL',
      anonymousMode: false,
      teamMode: false,
    });
    const host = createHttpTrpcSingle(TRPC_URL, created.hostToken);
    await configureQaSessionIfNeeded(host, created.code, { qaTitle: 'Referat 2B Burst' });
    const tn: Json[] = [];
    for (let i = 0; i < TEILNEHMENDE; i += 1) {
      const p = await pub.session.join.mutate({
        code: created.code,
        nickname: `Referat T2G8 TN ${String(i + 1).padStart(2, '0')}`,
        anonymousClientId: globalThis.crypto.randomUUID(),
        joinIdempotencyKey: globalThis.crypto.randomUUID(),
      });
      tn.push({
        ...p,
        trpc: createHttpTrpcSingle(TRPC_URL, undefined, undefined, undefined, p.rejoinToken),
      });
    }
    const texte = referenzTexte();
    const metrik = async () =>
      (await host.qa.nlpRuntime.query({ sessionId: created.sessionId })) as Json;
    const statusVerteilung = async () =>
      Object.fromEntries(
        (
          await prisma.qaQuestion.groupBy({
            by: ['nlpStatus'],
            where: { sessionId: created.sessionId },
            _count: { _all: true },
          })
        ).map((g: Json) => [g.nlpStatus, g._count._all]),
      );

    const vorher = await metrik();
    await new Promise((r) => setTimeout(r, 1000)); // RSS-Ruhewert
    const rssVorher = rss.at(-1) ?? null;

    // Burst: alle 200 Submits gleichzeitig abschicken
    const aufgaben = Array.from({ length: TEILNEHMENDE * FRAGEN_JE_TN }, (_, k) => ({
      tn: tn[k % TEILNEHMENDE],
      text: `${texte[k % texte.length]}`,
    }));
    const burstStart = performance.now();
    const ergebnisse = await Promise.allSettled(
      aufgaben.map(async (a) => {
        const s = performance.now();
        const r = await a.tn.trpc.qa.submit.mutate({
          sessionId: created.sessionId,
          participantId: a.tn.participantId,
          text: a.text,
          idempotencyKey: globalThis.crypto.randomUUID(),
        });
        const e = performance.now();
        return {
          startMs: s - burstStart,
          endeMs: e - burstStart,
          dauerMs: e - s,
          replayed: r.replayed,
        };
      }),
    );
    const burstEnde = performance.now();
    // Direkt nach der letzten Submit-Antwort: Zustand von Queue und DB
    const [direktMetrik, direktDb] = await Promise.all([metrik(), statusVerteilung()]);
    const direktMs = performance.now() - burstStart;

    // Bis Leerlauf warten (Queue leer, keine Änderung der Zähler über 1 s), max. 60 s
    const verlauf: Json[] = [{ tMs: Math.round(direktMs), ...direktMetrik.metrics }];
    let stabil = 0;
    let letzte = JSON.stringify(direktMetrik.metrics);
    while (performance.now() - burstStart < 60_000 && stabil < 5) {
      await new Promise((r) => setTimeout(r, 200));
      const m = await metrik();
      verlauf.push({ tMs: Math.round(performance.now() - burstStart), ...m.metrics });
      const jetzt = JSON.stringify(m.metrics);
      stabil = jetzt === letzte && m.metrics.queueLength === 0 ? stabil + 1 : 0;
      letzte = jetzt;
    }
    const nachher = await metrik();
    const endDb = await statusVerteilung();
    const fehlgeschlagen = await prisma.qaQuestion.groupBy({
      by: ['nlpStatus', 'nlpModelVersion'],
      where: { sessionId: created.sessionId },
      _count: { _all: true },
    });

    const ok = ergebnisse.filter((r) => r.status === 'fulfilled').map((r) => (r as Json).value);
    const fehler = ergebnisse
      .filter((r) => r.status === 'rejected')
      .map((r) => String((r as Json).reason?.message ?? (r as Json).reason));
    const delta = (k: string) => (nachher.metrics[k] ?? 0) - (vorher.metrics[k] ?? 0);
    const ergebnis = {
      konfig,
      lauf,
      erzeugt: new Date().toISOString(),
      trpcUrl: TRPC_URL,
      session: { code: created.code, sessionId: created.sessionId },
      teilnehmende: TEILNEHMENDE,
      submits: aufgaben.length,
      nlpEnabled: nachher.enabled,
      submitOk: ok.length,
      submitFehler: fehler.length,
      fehlerArten: [...new Set(fehler)].slice(0, 5),
      burstDauerMs: Number((burstEnde - burstStart).toFixed(1)),
      submitLatenz: zusammenfassen(ok.map((x: Json) => x.dauerMs)),
      direktNachLetzterAntwort: {
        tMs: Math.round(direktMs),
        db: direktDb,
        metrics: direktMetrik.metrics,
        metricsDelta: Object.fromEntries(
          ['completed', 'failed', 'skipped'].map((k) => [
            k,
            (direktMetrik.metrics[k] ?? 0) - (vorher.metrics[k] ?? 0),
          ]),
        ),
      },
      ende: {
        db: endDb,
        dbNachModell: fehlgeschlagen.map((g: Json) => ({
          nlpStatus: g.nlpStatus,
          nlpModelVersion: g.nlpModelVersion,
          n: g._count._all,
        })),
        metrics: nachher.metrics,
        metricsDelta: Object.fromEntries(
          ['completed', 'failed', 'skipped', 'earlyExit', 'fallback', 'unclassified'].map((k) => [
            k,
            delta(k),
          ]),
        ),
      },
      verlauf,
      rss: {
        vorherKb: rssVorher,
        maxVmRssKb: Math.max(...rss.map((r) => r.vmRssKb)),
        maxRssAnonKb: Math.max(...rss.map((r) => r.rssAnonKb)),
        proben: rss.length,
      },
      rssVerlauf: rss,
      submitsRoh: ok,
    };
    mkdirSync(path.dirname(path.resolve(ROOT, out)), { recursive: true });
    writeFileSync(path.resolve(ROOT, out), `${JSON.stringify(ergebnis, null, 2)}\n`);
    process.stdout.write(
      `${konfig} Lauf ${lauf}: Submits ${ok.length}/${aufgaben.length} (Fehler ${fehler.length}) · p50 ${ergebnis.submitLatenz.p50Ms} ms · p95 ${ergebnis.submitLatenz.p95Ms} ms · Burst ${ergebnis.burstDauerMs} ms · direkt danach DB ${JSON.stringify(direktDb)} Δcompleted ${ergebnis.direktNachLetzterAntwort.metricsDelta.completed} · Ende DB ${JSON.stringify(endDb)} Δ completed ${delta('completed')} skipped ${delta('skipped')} failed ${delta('failed')} · RSS max ${(ergebnis.rss.maxVmRssKb / 1024).toFixed(0)} MiB\n`,
    );
  } finally {
    clearInterval(sampler);
    await prisma.$disconnect();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    process.stderr.write(
      `Burst fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(1);
  });
