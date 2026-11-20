/**
 * Versuchscode Referat Thema 2 / Auftrag 2A, Schritt 3.1 – kein Produktpfad.
 *
 * Regelkern über Raumgrößen P = 50/200/500/1000 mit dem Sechs-Fragen-Szenario
 * (referat/fixtures/sechs-fragen-szenario.json, alle ACTIVE).
 *
 * Ausgabe: referat/evidenz/2a/baseline-raumgroessen.json und .md
 * Vergleich: vorab gerechnete Tabelle aus plaene-2a-2b-2c.md §0.2 (hier als
 * Konstante PLAN_TABELLE abgeschrieben, Stand der Datei vom 2026-11-04).
 */
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MODERATION_PROMPT_REFERENCE_RANKING_FIXTURE_V1 } from '../../libs/shared-types/src/moderation-prompt-context-fixtures';
import {
  REPO_ROOT,
  cardsLabel,
  fmt,
  loadFixture,
  runRegelkern,
  sqlBestScore,
  sqlControversyScore,
  type RunResult,
} from './lib/regelkern';

const OUT_DIR = path.join(REPO_ROOT, 'referat/evidenz/2a');
// Ergebnisdateien nur mit REFERAT_WRITE_EVIDENCE=1 schreiben; sonst nur prüfen
// (verhindert, dass ein Prüflauf protokollierte Evidenz überschreibt).
const WRITE_EVIDENCE = process.env['REFERAT_WRITE_EVIDENCE'] === '1';

/** plaene-2a-2b-2c.md §0.2, wörtlich übertragen. `unterT` = Zusatz „< T Stimmen“. */
const PLAN_TABELLE: Record<
  number,
  { T: number; K: Record<'A' | 'E' | 'F', { wert: number; umstritten?: true; unterT?: true }> }
> = {
  50: { T: 5, K: { A: { wert: 0.52, umstritten: true }, E: { wert: 0.94 }, F: { wert: 0.89 } } },
  200: { T: 20, K: { A: { wert: 0.46 }, E: { wert: 0.8 }, F: { wert: 0.67 } } },
  500: { T: 50, K: { A: { wert: 0.38 }, E: { wert: 0.62 }, F: { wert: 0.44, unterT: true } } },
  1000: {
    T: 100,
    K: { A: { wert: 0.27 }, E: { wert: 0.44, unterT: true }, F: { wert: 0.29, unterT: true } },
  },
};

type Abweichung = { P: number; feld: string; plan: string; ist: string };

function vergleicheMitPlan(run: RunResult): { abweichungen: Abweichung[]; geprueft: number } {
  const plan = PLAN_TABELLE[run.P];
  const abweichungen: Abweichung[] = [];
  let geprueft = 0;
  if (!plan) return { abweichungen, geprueft };
  geprueft += 1;
  if (plan.T !== run.T) {
    abweichungen.push({ P: run.P, feld: 'T', plan: String(plan.T), ist: String(run.T) });
  }
  for (const key of ['A', 'E', 'F'] as const) {
    const q = run.questions.find((x) => x.key === key)!;
    const erwartet = plan.K[key];
    const istGerundet = Math.round(q.controversyScore * 100) / 100;
    geprueft += 1;
    if (Math.abs(istGerundet - erwartet.wert) > 1e-9) {
      abweichungen.push({
        P: run.P,
        feld: `K(${key})`,
        plan: fmt(erwartet.wert, 2),
        ist: `${fmt(istGerundet, 2)} (exakt ${fmt(q.controversyScore, 6)})`,
      });
    }
    if (erwartet.umstritten) {
      geprueft += 1;
      if (q.badge !== 'controversial') {
        abweichungen.push({ P: run.P, feld: `Badge(${key})`, plan: 'umstritten', ist: q.badge });
      }
    }
    if (erwartet.unterT) {
      geprueft += 1;
      if (!(q.total < run.T)) {
        abweichungen.push({
          P: run.P,
          feld: `U+D<T (${key})`,
          plan: '< T Stimmen',
          ist: `${q.total} ≥ T=${run.T}`,
        });
      }
    }
  }
  return { abweichungen, geprueft };
}

function gitHead(): string {
  try {
    return execSync('git rev-parse HEAD', { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
  } catch {
    return 'unbekannt';
  }
}

function renderMarkdown(
  runs: RunResult[],
  abweichungen: Abweichung[],
  meta: Record<string, string>,
): string {
  const lines: string[] = [];
  lines.push('# 2A · Baseline Regelkern über Raumgrößen (Schritt 3.1)');
  lines.push('');
  lines.push(`- Erzeugt: ${meta.erzeugt}`);
  lines.push(`- HEAD Arbeitsbranch: \`${meta.head}\` (Produktcode = Referenz-Commit \`efd71b44\`)`);
  lines.push(`- Regelversion: \`${meta.rulesVersion}\``);
  lines.push('- Fixture: `referat/fixtures/sechs-fragen-szenario.json` (A–F, alle ACTIVE)');
  lines.push(
    '- Aufruf: `REFERAT_WRITE_EVIDENCE=1 npx vitest run --config referat/2a/vitest.config.ts regelkern-raumgroessen`',
  );
  lines.push('- Hardware: siehe `referat/evidenz/manifest.md`');
  lines.push(
    '- Echte Funktionen: `resolveQaControversyThreshold`, `isQaControversialLabel`, `isQaControversyInsufficientVotes`, `resolveQaControversyBadgeKind`, `selectPendingModerationQuestionSourceIds`, `selectFrictionQuestionSourceIds`, `planModerationCompass`. K und Best-Score nach `qaRankingSql.ts` nachgerechnet; Verdrahtung wie `buildCompassContext` (nur Q&A-Anteil, keine Themen/Quiz/Blitzlicht).',
  );
  lines.push('');
  lines.push(
    'Badges: `controversial` = umstritten (K > 0,5 und U+D ≥ T), `insufficient` = zu wenige Stimmen (U+D < T), `onesided` = einseitig.',
  );
  lines.push('');
  lines.push(
    '> **Hinweis zu P = 50:** Die Zeile P = 50 ist rechnerisch, aber nicht realisierbar. Frage A hat 80 + 30 = 110 Stimmen, ' +
      'in der Session gibt es aber nur 50 Teilnehmende, und jede Stimme stammt von einer eigenen Person ' +
      '(QaUpvote eindeutig je Person und Frage). Da Autor:innen ihre eigene Frage nicht bewerten dürfen ' +
      '(`apps/backend/src/routers/qa.ts:345`), ist die Fixture erst ab P ≥ 111 konsistent. Für P = 50 gibt es den ' +
      'realisierbaren Fall „P50-skaliert“ (Stimmen × 0,4) in `referat/evidenz/2a/p50-skaliert.md`.',
  );
  lines.push('');
  for (const run of runs) {
    lines.push(`## P = ${run.P} · T = ${run.T}`);
    lines.push('');
    lines.push('| Frage | U/D | U+D | K (controversyScore) | Best-Score | Badge |');
    lines.push('| ----- | --: | --: | -------------------: | ---------: | ----- |');
    for (const q of run.questions) {
      lines.push(
        `| ${q.key} | ${q.positive}/${q.negative} | ${q.total} | ${fmt(q.controversyScore)} | ${fmt(q.bestScore)} | ${q.badge} |`,
      );
    }
    lines.push('');
    lines.push(`- Karten: ${cardsLabel(run.cards)}`);
    lines.push(
      `- Nächster Schritt: ${run.nextStep ?? '— (keine Empfehlung)'}` +
        (run.recommendation
          ? ` (Karte \`${run.recommendation.preferredCardKind}\`, attachToCard=${run.recommendation.attachToCard}` +
            (run.recommendation.attachToCard
              ? ')'
              : ' – tautologisch bei nur einer Karte, nicht angehängt)')
          : ''),
    );
    lines.push(
      `- Quellen: ${run.sourceKeys.length > 0 ? run.sourceKeys.join(', ') : '—'}` +
        (run.cards.length > 0
          ? ` (${run.cards
              .flatMap((c) => c.sourceIds)
              .filter((v, i, a) => a.indexOf(v) === i)
              .map((id) => `\`${id}\``)
              .join(', ')})`
          : ''),
    );
    lines.push('');
  }
  lines.push('## Übersicht K je Raumgröße');
  lines.push('');
  lines.push(`| Frage | ${runs.map((r) => `P=${r.P} (T=${r.T})`).join(' | ')} |`);
  lines.push(`| ----- | ${runs.map(() => '---').join(' | ')} |`);
  for (const key of runs[0]!.questions.map((q) => q.key)) {
    lines.push(
      `| ${key} | ${runs
        .map((r) => {
          const q = r.questions.find((x) => x.key === key)!;
          const mark =
            q.badge === 'controversial'
              ? ' **umstritten**'
              : q.badge === 'insufficient'
                ? ' < T'
                : '';
          return `${fmt(q.controversyScore, 2)}${mark}`;
        })
        .join(' | ')} |`,
    );
  }
  lines.push('');
  lines.push('## Abgleich mit plaene-2a-2b-2c.md §0.2');
  lines.push('');
  lines.push(
    'Geprüft: T je P, K(A)/K(E)/K(F) auf zwei Nachkommastellen gerundet, Markierung „umstritten“ bzw. „< T Stimmen“, soweit die Plantabelle sie nennt.',
  );
  lines.push('');
  if (abweichungen.length === 0) {
    lines.push('Keine Abweichungen.');
  } else {
    lines.push('| P | Feld | Plan | Ist | |');
    lines.push('| -: | ---- | ---- | --- | - |');
    for (const a of abweichungen) {
      lines.push(`| ${a.P} | ${a.feld} | ${a.plan} | ${a.ist} | ⚠️ **Abweichung** |`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

describe('2A · Schritt 3.1 · Regelkern über Raumgrößen', () => {
  const fixture = loadFixture();

  it('SQL-Nachrechnung reproduziert die Produkt-Referenzwerte (N=200, T=20)', () => {
    for (const ref of MODERATION_PROMPT_REFERENCE_RANKING_FIXTURE_V1) {
      expect(sqlBestScore(ref.positive, ref.negative)).toBeCloseTo(ref.bestScore, 12);
      expect(sqlControversyScore(ref.positive, ref.negative, 20)).toBeCloseTo(
        ref.controversyScore,
        12,
      );
    }
  });

  it('läuft für alle Raumgrößen und schreibt die Baseline', () => {
    expect(fixture.raumgroessen).toEqual([50, 200, 500, 1000]);
    expect(fixture.fragen.every((q) => q.status === 'ACTIVE')).toBe(true);

    const runs = fixture.raumgroessen.map((P) => runRegelkern(P, fixture.fragen));
    const vergleiche = runs.map(vergleicheMitPlan);
    const abweichungen = vergleiche.flatMap((v) => v.abweichungen);

    const meta = {
      erzeugt: new Date().toISOString(),
      head: gitHead(),
      rulesVersion: runs[0]!.rulesVersion,
    };
    if (WRITE_EVIDENCE) {
      mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(
        path.join(OUT_DIR, 'baseline-raumgroessen.json'),
        `${JSON.stringify(
          {
            schritt: '3.1',
            ...meta,
            referenzCommit: 'efd71b44d4fd32d711cd483606ce5eefd1e9af5b',
            fixture: 'referat/fixtures/sechs-fragen-szenario.json',
            fixtureId: fixture.fixtureId,
            flags: 'keine (reiner Regelkern, ohne Backend)',
            runs,
            planAbgleich: {
              quelle: 'plaene-2a-2b-2c.md §0.2',
              geprueftePunkte: vergleiche.reduce((s, v) => s + v.geprueft, 0),
              abweichungen,
            },
          },
          null,
          2,
        )}\n`,
      );
      writeFileSync(
        path.join(OUT_DIR, 'baseline-raumgroessen.md'),
        renderMarkdown(runs, abweichungen, meta),
      );
    }

    // Prüfpunkt aus dem Runbook: A bei P=50 Reibung; E/F verlieren bei P=1000 das Signal.
    const p50 = runs.find((r) => r.P === 50)!;
    const p1000 = runs.find((r) => r.P === 1000)!;
    expect(p50.frictionQuestionSourceIds).toContain(
      p50.questions.find((q) => q.key === 'A')!.sourceId,
    );
    expect(
      p1000.questions.filter((q) => q.key === 'E' || q.key === 'F').map((q) => q.badge),
    ).toEqual(['insufficient', 'insufficient']);
  });
});
