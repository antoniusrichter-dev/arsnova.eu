/**
 * ============================================================================
 * VERSUCHSCODE – KEIN PRODUKTPFAD (Referat Thema 2, Auftrag 2B, Schritt 4.3)
 * ============================================================================
 * Wertet referat/evidenz/2b/last/ aus:
 *   - Burst-Läufe (*-laufN.json): Submit-Latenz, Zustand direkt nach der letzten Antwort,
 *     Endzustand, RSS des Backend-Prozesses
 *   - Backend-Logs (backend-<konfig>.log): Anzahl qa_nlp:completed / qa_nlp:skipped /
 *     qa_nlp:failed, latencyMs aus qa_nlp:completed (Verarbeitung + DB-Schreiben unter Last,
 *     ohne Wartezeit in der Queue; siehe processJob in qaNlpQueue.ts)
 *   - Mikromessung: reine Klassifikationszeit classifyQaNlpCascade je Frage (in-process,
 *     ohne DB, ohne Last), 80 Referenzfragen × 20 Wiederholungen nach 1 Aufwärmrunde
 *
 * Ausgabe: referat/evidenz/2b/last/zusammenfassung.{json,md}
 * Aufruf aus Repo-Root: npx tsx referat/2b/burst-auswertung.ts
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { classifyQaNlpCascade } from '../../apps/backend/src/lib/qaNlpCascade';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const DIR = path.join(ROOT, 'referat/evidenz/2b/last');
const KONFIGS = ['aus', 'an-limit100', 'an-limit20'] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

function perzentil(values: number[], p: number): number {
  if (!values.length) return NaN;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]!;
}
const stat = (v: number[], d = 1) => ({
  n: v.length,
  p50: Number(perzentil(v, 50).toFixed(d)),
  p95: Number(perzentil(v, 95).toFixed(d)),
  max: Number(Math.max(...v).toFixed(d)),
});
const de = (x: number, d = 0) => (Number.isFinite(x) ? x.toFixed(d).replace('.', ',') : '–');

function logAuswertung(konfig: string) {
  const src = readFileSync(path.join(DIR, `backend-${konfig}.log`), 'utf8');
  // util.inspect-Ausgabe: Block ab „qa_nlp:<art> {“ bis zur schließenden Klammer
  const bloecke = [
    ...src.matchAll(/qa_nlp:(completed|skipped|failed|persist_failed) \{([^}]*)\}/gu),
  ];
  const zahl = (body: string, k: string) =>
    Number(new RegExp(`${k}: (\\d+)`, 'u').exec(body)?.[1] ?? NaN);
  const completed = bloecke.filter((b) => b[1] === 'completed');
  return {
    completed: completed.length,
    skipped: bloecke.filter((b) => b[1] === 'skipped').length,
    failed: bloecke.filter((b) => b[1] === 'failed').length,
    persistFailed: bloecke.filter((b) => b[1] === 'persist_failed').length,
    skippedGrund: [
      ...new Set(
        bloecke.filter((b) => b[1] === 'skipped').map((b) => /reason: '([^']+)'/u.exec(b[2]!)?.[1]),
      ),
    ],
    latencyMsCompleted: completed.length
      ? stat(
          completed.map((b) => zahl(b[2]!, 'latencyMs')),
          0,
        )
      : null,
    queueLengthMaxBeiCompleted: completed.length
      ? Math.max(...completed.map((b) => zahl(b[2]!, 'queueLength')))
      : null,
  };
}

function mikromessung() {
  const src = readFileSync(path.join(ROOT, 'referat/2b/referenz.csv'), 'utf8');
  const texte = [...src.matchAll(/^R\d+,("(?:[^"]|"")*"|[^,]*),/gmu)].map((m) =>
    m[1]!.startsWith('"') ? m[1]!.slice(1, -1).replaceAll('""', '"') : m[1]!,
  );
  const t = new Date('2026-01-01T00:00:00Z');
  for (const text of texte) classifyQaNlpCascade({ text }, 0.55, t); // Aufwärmen (Modellaufbau)
  const ms: number[] = [];
  for (let r = 0; r < 20; r += 1) {
    for (const text of texte) {
      const s = performance.now();
      classifyQaNlpCascade({ text }, 0.55, t);
      ms.push(performance.now() - s);
    }
  }
  return { fragen: texte.length, wiederholungen: 20, ...stat(ms, 3) };
}

function main(): void {
  const laeufe = readdirSync(DIR)
    .filter((f) => /-lauf\d+\.json$/u.test(f))
    .sort()
    .map((f) => JSON.parse(readFileSync(path.join(DIR, f), 'utf8')) as Json);
  const konfigs = Object.fromEntries(
    KONFIGS.map((k) => {
      const ls = laeufe.filter((l) => l.konfig === k).sort((a, b) => a.lauf - b.lauf);
      const warm = ls.filter((l) => l.lauf > 1);
      return [
        k,
        {
          laeufe: ls.map((l) => ({
            lauf: l.lauf,
            submitOk: l.submitOk,
            submitFehler: l.submitFehler,
            p50Ms: l.submitLatenz.p50Ms,
            p95Ms: l.submitLatenz.p95Ms,
            maxMs: l.submitLatenz.maxMs,
            burstMs: l.burstDauerMs,
            direktDb: l.direktNachLetzterAntwort.db,
            direktCompletedDelta: l.direktNachLetzterAntwort.metricsDelta.completed,
            endeDb: l.ende.db,
            endeDelta: l.ende.metricsDelta,
            failedNachModell: l.ende.dbNachModell.filter((x: Json) => x.nlpStatus === 'FAILED'),
            rssMaxMiB: Number((l.rss.maxVmRssKb / 1024).toFixed(0)),
            rssAnonMaxMiB: Number((l.rss.maxRssAnonKb / 1024).toFixed(0)),
            rssVorherMiB: l.rss.vorherKb
              ? Number((l.rss.vorherKb.vmRssKb / 1024).toFixed(0))
              : null,
          })),
          warmP50Median: perzentil(
            warm.map((l) => l.submitLatenz.p50Ms),
            50,
          ),
          warmP95Median: perzentil(
            warm.map((l) => l.submitLatenz.p95Ms),
            50,
          ),
          log: logAuswertung(k),
          metricsEnde: ls.at(-1)?.ende.metrics ?? null,
        },
      ];
    }),
  );
  const ergebnis = {
    erzeugt: new Date().toISOString(),
    konfigs,
    klassifikationMikro: mikromessung(),
  };
  writeFileSync(path.join(DIR, 'zusammenfassung.json'), `${JSON.stringify(ergebnis, null, 2)}\n`);

  const z: string[] = [];
  z.push(
    '| Konfiguration | Lauf | Submits ok | p50 (ms) | p95 (ms) | max (ms) | Burst (ms) | DB direkt nach letzter Antwort | DB am Ende | Δ completed / skipped / failed | RSS vorher → max (MiB) |',
  );
  z.push(
    '| ------------- | ---: | ---------: | -------: | -------: | -------: | ---------: | ------------------------------ | ---------- | ------------------------------ | ---------------------: |',
  );
  for (const k of KONFIGS) {
    for (const l of (konfigs[k] as Json).laeufe) {
      const db = (o: Json) =>
        Object.entries(o)
          .map(([s, n]) => `${s} ${n}`)
          .join(', ');
      z.push(
        `| ${k} | ${l.lauf}${l.lauf === 1 ? ' (kalt)' : ''} | ${l.submitOk}/200 | ${de(l.p50Ms)} | ${de(l.p95Ms)} | ${de(l.maxMs)} | ${de(l.burstMs)} | ${db(l.direktDb)} | ${db(l.endeDb)} | ${l.endeDelta.completed} / ${l.endeDelta.skipped} / ${l.endeDelta.failed} | ${l.rssVorherMiB} → ${l.rssMaxMiB} |`,
      );
    }
  }
  z.push(
    '',
    '| Konfiguration | Log qa_nlp:completed | Log qa_nlp:skipped (Grund) | Log qa_nlp:failed | latencyMs completed p50 / p95 / max | Submit p50 / p95 Läufe 2–3 (Median, ms) |',
  );
  z.push(
    '| ------------- | -------------------: | -------------------------- | ----------------: | ----------------------------------- | --------------------------------------- |',
  );
  for (const k of KONFIGS) {
    const c = konfigs[k] as Json;
    const lat = c.log.latencyMsCompleted;
    z.push(
      `| ${k} | ${c.log.completed} | ${c.log.skipped}${c.log.skippedGrund.length ? ` (${c.log.skippedGrund.join(', ')})` : ''} | ${c.log.failed} | ${lat ? `${lat.p50} / ${lat.p95} / ${lat.max}` : '–'} | ${de(c.warmP50Median)} / ${de(c.warmP95Median)} |`,
    );
  }
  const m = ergebnis.klassifikationMikro;
  z.push(
    '',
    `Reine Klassifikation (classifyQaNlpCascade, in-process, ohne DB/Last): ${m.fragen} Fragen × ${m.wiederholungen} = ${m.n} Messungen, p50 ${de(m.p50, 3)} ms, p95 ${de(m.p95, 3)} ms, max ${de(m.max, 3)} ms.`,
  );
  writeFileSync(path.join(DIR, 'zusammenfassung.md'), `${z.join('\n')}\n`);
  process.stdout.write(`${z.join('\n')}\n`);
}

main();
