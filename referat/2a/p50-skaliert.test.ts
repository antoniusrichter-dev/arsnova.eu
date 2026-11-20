/**
 * Versuchscode Referat Thema 2 / Auftrag 2A – kein Produktpfad.
 *
 * Fall „P50-skaliert“: Die Fixture ist bei P = 50 nicht realisierbar (A braucht
 * 110 Stimmen). Entscheidung der Gruppe: Stimmen proportional verkleinern.
 * Die Skalierung kommt aus dem Seed (referat/fixtures/seed-sechs-fragen.ts →
 * planStimmen), damit Regelkern-Rechnung und Datenbank-Seed dieselben Werte nutzen.
 *
 * Ausgabe: referat/evidenz/2a/p50-skaliert.json und .md
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadFixture as loadSeedFixture, planStimmen } from '../fixtures/seed-sechs-fragen';
import { REPO_ROOT, cardsLabel, fmt, loadFixture, runRegelkern } from './lib/regelkern';

const OUT_DIR = path.join(REPO_ROOT, 'referat/evidenz/2a');
// Ergebnisdateien nur mit REFERAT_WRITE_EVIDENCE=1 schreiben; sonst nur prüfen
// (verhindert, dass ein Prüflauf protokollierte Evidenz überschreibt).
const WRITE_EVIDENCE = process.env['REFERAT_WRITE_EVIDENCE'] === '1';

describe('2A · Fall P50-skaliert', () => {
  it('berechnet K/Badges/Karten für die skalierten Stimmen', () => {
    const fixture = loadFixture();
    const plan = planStimmen(loadSeedFixture(), 50, true);
    expect(plan.fall).toBe('P50-skaliert');
    expect(plan.faktor).toBe(0.4);
    // Realisierbar: jede Frage höchstens P − 1 = 49 Stimmen (ohne Autor:in).
    expect(Math.max(...plan.fragen.map((q) => q.positive + q.negative))).toBeLessThanOrEqual(49);

    const fragen = fixture.fragen.map((q) => {
      const s = plan.fragen.find((x) => x.key === q.key)!;
      return { ...q, positive: s.positive, negative: s.negative };
    });
    const skaliert = runRegelkern(50, fragen);
    const rechnerisch = runRegelkern(50, fixture.fragen);

    const lines: string[] = [];
    lines.push('# 2A · Fall „P50-skaliert“');
    lines.push('');
    lines.push(`- Erzeugt: ${new Date().toISOString()}`);
    lines.push('- Aufruf: `REFERAT_WRITE_EVIDENCE=1 npx vitest run --config referat/2a/vitest.config.ts p50-skaliert`');
    lines.push(
      '- Grund: Die Fixture ist bei P = 50 nicht realisierbar (A hat 110 Stimmen > 50 Teilnehmende, Eigenbewertung gesperrt → erst ab P ≥ 111 konsistent).',
    );
    lines.push(
      `- Regel (aus \`referat/fixtures/seed-sechs-fragen.ts\`, \`planStimmen\`): f = ⌊10 · (P − 1) / maxStimmen⌋ / 10 = ⌊10 · 49 / 110⌋ / 10 = **${fmt(plan.faktor, 1)}**, Stimmen × f, kaufmännisch gerundet.`,
    );
    lines.push(
      '- Derselbe Fall wird in 3.3 per Seed in die Datenbank geschrieben (`--p 50 --skaliert`).',
    );
    lines.push(`- P = 50, T = ${skaliert.T}, Regelversion \`${skaliert.rulesVersion}\``);
    lines.push('');
    lines.push(
      '| Frage | Fixture U/D | skaliert U/D | U+D | K skaliert | Badge skaliert | K rechnerisch (3.1) | Badge rechnerisch (3.1) |',
    );
    lines.push(
      '| ----- | ----------: | -----------: | --: | ---------: | -------------- | ------------------: | ----------------------- |',
    );
    for (const q of skaliert.questions) {
      const f = fixture.fragen.find((x) => x.key === q.key)!;
      const r = rechnerisch.questions.find((x) => x.key === q.key)!;
      const rundung =
        Math.abs((f.positive ?? 0) * plan.faktor - (q.positive ?? 0)) > 1e-9 ||
        Math.abs((f.negative ?? 0) * plan.faktor - (q.negative ?? 0)) > 1e-9;
      lines.push(
        `| ${q.key} | ${f.positive}/${f.negative} | ${q.positive}/${q.negative}${rundung ? ' ¹' : ''} | ${q.total} | ${fmt(q.controversyScore)} | ${q.badge} | ${fmt(r.controversyScore)} | ${r.badge} |`,
      );
    }
    lines.push('');
    lines.push('¹ gerundet (12 × 0,4 = 4,8 → 5).');
    lines.push('');
    lines.push(`- Karten skaliert: ${cardsLabel(skaliert.cards)}`);
    lines.push(`- Nächster Schritt skaliert: ${skaliert.nextStep ?? '—'}`);
    lines.push(`- Karten rechnerisch (3.1): ${cardsLabel(rechnerisch.cards)}`);
    lines.push('');
    const changed = skaliert.questions.filter(
      (q) => q.badge !== rechnerisch.questions.find((x) => x.key === q.key)!.badge,
    );
    lines.push('## Unterschied zur rechnerischen Zeile P = 50');
    lines.push('');
    if (changed.length === 0) {
      lines.push('Keine Badge-Änderung.');
    } else {
      for (const q of changed) {
        const r = rechnerisch.questions.find((x) => x.key === q.key)!;
        lines.push(
          `- ${q.key}: ${r.badge} → ${q.badge} (K ${fmt(r.controversyScore)} → ${fmt(q.controversyScore)})`,
        );
      }
    }
    lines.push('');
    lines.push(
      'Einordnung: Beim Verkleinern bleibt T = 5 gleich, während U + D schrumpft. Damit fällt K = 2·min(U,D)/(U+D+T) für jede Frage mit Gegenstimmen. P50-skaliert ist deshalb nicht mit der rechnerischen Zeile P = 50 aus 3.1 vergleichbar, sondern ein eigener Fall.',
    );
    lines.push('');

    if (WRITE_EVIDENCE) {
      mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(path.join(OUT_DIR, 'p50-skaliert.md'), lines.join('\n'));
      writeFileSync(
        path.join(OUT_DIR, 'p50-skaliert.json'),
        `${JSON.stringify({ fall: plan.fall, faktor: plan.faktor, skalierung: plan.fragen, skaliert, rechnerischP50: rechnerisch }, null, 2)}\n`,
      );
    }
  });
});
