/**
 * Versuchscode Referat Thema 2 / Auftrag 2A, Schritt 3.2 – kein Produktpfad.
 *
 * Gegenfälle zum Regelkern. Basis ist das Sechs-Fragen-Szenario (alle ACTIVE) bei
 * P = 50 (T = 5). Baseline dort (siehe 3.1): Reibungskarte [E, F, A], nächster Schritt
 * `controversy`, keine Klärungskarte.
 *
 * ERWARTUNGEN – vor der Ausführung notiert (2026-11-17), nicht nachträglich angepasst:
 *
 * (1) E mit Status PENDING
 *     selectFrictionQuestionSourceIds sieht nur ACTIVE/PINNED, und buildCompassContext
 *     filtert PENDING vor der Reibungsauswahl heraus. E verlässt also die Reibung und landet
 *     über selectPendingModerationQuestionSourceIds in der Klärung.
 *     Erwartet: Klärung [E], Reibung [F, A], nächster Schritt `pending-qa` (Vorrang vor
 *     `controversy`), an die Klärungskarte angehängt (zwei Karten → attachToCard = true).
 *
 * (2) Archivierte und gelöschte Frage (F ARCHIVED, A DELETED)
 *     Im Releasepfad lädt loadQaCandidateRows nur PENDING/ACTIVE/PINNED. Auch ohne diesen
 *     Filter würden die Regelfunktionen beide verwerfen.
 *     Erwartet: Reibung nur noch [E], keine Klärung, nächster Schritt `controversy`.
 *     Das gilt mit und ohne Kandidatenfilter gleich.
 *
 * (3) Frage ohne Stimmen (G, Stimmen nicht verfügbar) vs. Frage mit 0/0 (H)
 *     buildCompassContext setzt fehlende Stimmen auf positive = negative = 0 und K = 0.
 *     Erwartet: G und H sind auf Regelebene ununterscheidbar (K = 0, U+D = 0, Badge
 *     `insufficient`, weil 0 < T = 5) und erscheinen in keiner Karte. Die Karten bleiben wie
 *     in der Baseline. Die Unterscheidung „fehlend ≠ 0“ existiert nur im Kontextvertrag
 *     (votes.state), nicht in den Karten.
 *
 * (4) Neues unbewertetes Anliegen (G: „Wird die Vorlesung aufgezeichnet?“, 0/0)
 *     (4a) Als ACTIVE (Moderation aus): weder Reibung noch Klärung.
 *          Erwartet: G ist im Kompass unsichtbar, Karten wie Baseline.
 *     (4b) Als PENDING (Default qaModerationMode = true): Klärung [G], `pending-qa`.
 *
 * (5) Nicht freigegebene Quizergebnisse
 *     (5a) Echte Freigabeprüfung collectReleasedQuizSignals mit einer Quizfrage im Zustand
 *          OPENED (nicht COMPLETED). Erwartet: releasedResults.state = 'not-released',
 *          insights = [], Limitation `not-released`. Damit kommen keine Quizquellen in den
 *          Planner, und die Karten bleiben wie in der Baseline.
 *     (5b) Gegenprobe ohne Gate: Ein Quizfakt (wrong-majority aus collectModerationQuizFacts)
 *          wird direkt an planModerationCompass übergeben. Erwartet: Klärungskarte mit der
 *          Quizquelle und `quiz-confusion`. Das zeigt, dass der Planner selbst keine Freigabe
 *          prüft und der Schutz allein vorgelagert liegt.
 */
import { config as loadDotenv } from 'dotenv';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { collectModerationQuizFacts } from '../../libs/shared-types/src/moderation-compass-rules';
import {
  REPO_ROOT,
  cardsLabel,
  loadFixture,
  runRegelkern,
  type FixtureQuestion,
  type RunResult,
} from './lib/regelkern';

// db.ts braucht DATABASE_URL beim Import; Wert wird nirgends ausgegeben.
loadDotenv({ path: path.join(REPO_ROOT, '.env'), quiet: true });

const OUT_DIR = path.join(REPO_ROOT, 'referat/evidenz/2a');
// Ergebnisdateien nur mit REFERAT_WRITE_EVIDENCE=1 schreiben; sonst nur prüfen
// (verhindert, dass ein Prüflauf protokollierte Evidenz überschreibt).
const WRITE_EVIDENCE = process.env['REFERAT_WRITE_EVIDENCE'] === '1';
const P = 50;

type Erwartung = {
  friction: string[];
  clarification: string[];
  nextStep: string | null;
  attachToCard?: boolean;
  zusatz?: Record<string, unknown>;
};

type Fallergebnis = {
  id: string;
  titel: string;
  erwartung: Erwartung;
  ist: Erwartung;
  run: RunResult;
  stimmt: boolean;
  notiz?: string;
};

const ergebnisse: Fallergebnis[] = [];

function istVon(run: RunResult, zusatz?: Record<string, unknown>): Erwartung {
  return {
    friction: run.cards.find((c) => c.kind === 'friction')?.sourceKeys ?? [],
    clarification: run.cards.find((c) => c.kind === 'clarification')?.sourceKeys ?? [],
    nextStep: run.nextStep,
    attachToCard: run.recommendation?.attachToCard,
    ...(zusatz ? { zusatz } : {}),
  };
}

function vergleiche(erwartung: Erwartung, ist: Erwartung): boolean {
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  return (
    same(erwartung.friction, ist.friction) &&
    same(erwartung.clarification, ist.clarification) &&
    erwartung.nextStep === ist.nextStep &&
    (erwartung.attachToCard === undefined || erwartung.attachToCard === ist.attachToCard) &&
    (erwartung.zusatz === undefined || same(erwartung.zusatz, ist.zusatz))
  );
}

function record(
  id: string,
  titel: string,
  erwartung: Erwartung,
  run: RunResult,
  zusatz?: Record<string, unknown>,
  notiz?: string,
): Fallergebnis {
  const ist = istVon(run, zusatz);
  const result = { id, titel, erwartung, ist, run, stimmt: vergleiche(erwartung, ist), notiz };
  ergebnisse.push(result);
  return result;
}

const fixture = loadFixture();
const withChanges = (
  changes: Record<string, Partial<FixtureQuestion>>,
  extra: FixtureQuestion[] = [],
): FixtureQuestion[] => [
  ...fixture.fragen.map((q) => ({ ...q, ...(changes[q.key] ?? {}) })),
  ...extra,
];

const G_SOURCE = 'qa-question:77777777-7777-4777-8777-777777777777';
const H_SOURCE = 'qa-question:88888888-8888-4888-8888-888888888888';

describe('2A · Schritt 3.2 · Gegenfälle (P = 50, T = 5)', () => {
  it('(0) Baseline zum Vergleich', () => {
    const r = record(
      '0',
      'Baseline (alle ACTIVE)',
      { friction: ['E', 'F', 'A'], clarification: [], nextStep: 'controversy', attachToCard: false },
      runRegelkern(P, fixture.fragen),
    );
    expect(r.stimmt).toBe(true);
  });

  it('(1) E mit Status PENDING', () => {
    const r = record(
      '1',
      'E mit Status PENDING',
      { friction: ['F', 'A'], clarification: ['E'], nextStep: 'pending-qa', attachToCard: true },
      runRegelkern(P, withChanges({ E: { status: 'PENDING' } })),
    );
    expect(r.stimmt).toBe(true);
  });

  it('(2) archivierte (F) und gelöschte (A) Frage – mit Kandidatenfilter', () => {
    const r = record(
      '2a',
      'F ARCHIVED, A DELETED – Releasepfad (Kandidatenfilter PENDING/ACTIVE/PINNED)',
      { friction: ['E'], clarification: [], nextStep: 'controversy', attachToCard: false },
      runRegelkern(P, withChanges({ F: { status: 'ARCHIVED' }, A: { status: 'DELETED' } })),
    );
    expect(r.stimmt).toBe(true);
  });

  it('(2) archivierte (F) und gelöschte (A) Frage – nur Regelfunktionen, ohne Filter', () => {
    const r = record(
      '2b',
      'F ARCHIVED, A DELETED – Regelfunktionen ohne vorgelagerten Filter',
      { friction: ['E'], clarification: [], nextStep: 'controversy', attachToCard: false },
      runRegelkern(P, withChanges({ F: { status: 'ARCHIVED' }, A: { status: 'DELETED' } }), {
        applyCandidateFilter: false,
      }),
    );
    expect(r.stimmt).toBe(true);
  });

  it('(3) Frage ohne Stimmen vs. 0/0', () => {
    const run = runRegelkern(
      P,
      withChanges({}, [
        { key: 'G', sourceId: G_SOURCE, text: 'Frage ohne verfügbare Stimmen', status: 'ACTIVE', positive: null, negative: null },
        { key: 'H', sourceId: H_SOURCE, text: 'Frage mit 0/0', status: 'ACTIVE', positive: 0, negative: 0 },
      ]),
    );
    const g = run.questions.find((q) => q.key === 'G')!;
    const h = run.questions.find((q) => q.key === 'H')!;
    const regelebene = (q: typeof g) => ({
      K: q.controversyScore,
      total: q.total,
      badge: q.badge,
      inKarte: run.sourceKeys.includes(q.key),
    });
    const r = record(
      '3',
      'G ohne Stimmen (nicht verfügbar) vs. H mit 0/0',
      {
        friction: ['E', 'F', 'A'],
        clarification: [],
        nextStep: 'controversy',
        attachToCard: false,
        zusatz: {
          G: { K: 0, total: 0, badge: 'insufficient', inKarte: false },
          H: { K: 0, total: 0, badge: 'insufficient', inKarte: false },
          ununterscheidbar: true,
        },
      },
      run,
      {
        G: regelebene(g),
        H: regelebene(h),
        ununterscheidbar: JSON.stringify(regelebene(g)) === JSON.stringify(regelebene(h)),
      },
      'Auf Regelebene ist g.votesAvailable=false vs. h.votesAvailable=true nur im Harness sichtbar; die Produktfunktionen erhalten für beide dieselben Werte.',
    );
    expect(r.stimmt).toBe(true);
  });

  it('(4a) neues unbewertetes Anliegen als ACTIVE', () => {
    const run = runRegelkern(
      P,
      withChanges({}, [
        { key: 'G', sourceId: G_SOURCE, text: 'Wird die Vorlesung aufgezeichnet?', status: 'ACTIVE', positive: 0, negative: 0 },
      ]),
    );
    const r = record(
      '4a',
      'Neues Anliegen G „Wird die Vorlesung aufgezeichnet?“ 0/0, ACTIVE',
      {
        friction: ['E', 'F', 'A'],
        clarification: [],
        nextStep: 'controversy',
        attachToCard: false,
        zusatz: { gInKarte: false },
      },
      run,
      { gInKarte: run.sourceKeys.includes('G') },
    );
    expect(r.stimmt).toBe(true);
  });

  it('(4b) neues unbewertetes Anliegen als PENDING', () => {
    const run = runRegelkern(
      P,
      withChanges({}, [
        { key: 'G', sourceId: G_SOURCE, text: 'Wird die Vorlesung aufgezeichnet?', status: 'PENDING', positive: 0, negative: 0 },
      ]),
    );
    const r = record(
      '4b',
      'Neues Anliegen G 0/0, PENDING (Default qaModerationMode = true)',
      { friction: ['E', 'F', 'A'], clarification: ['G'], nextStep: 'pending-qa', attachToCard: true },
      run,
    );
    expect(r.stimmt).toBe(true);
  });

  it('(5a) nicht freigegebene Quizergebnisse – echte Freigabeprüfung', async () => {
    const { collectReleasedQuizSignals } = await import(
      '../../apps/backend/src/lib/moderationTeachingSignals'
    );
    const quizQuestionId = '99999999-9999-4999-8999-999999999999';
    // tx wird bei fehlendem COMPLETED-Eintrag nicht benutzt; Proxy wirft, falls doch.
    const tx = new Proxy({}, {
      get: (_t, prop) => {
        throw new Error(`tx.${String(prop)} wurde unerwartet aufgerufen`);
      },
    });
    const released = await collectReleasedQuizSignals({
      tx: tx as never,
      state: {
        type: 'QUIZ',
        quizId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        questionProgress: { [quizQuestionId]: { state: 'OPENED', openedAt: '2026-11-17T10:00:00.000Z' } },
      } as never,
    });
    const quizResultSourceIds = released.insights.flatMap((i) => i.facts.map((f) => f.sourceId));
    const run = runRegelkern(P, fixture.fragen, { planExtras: { quizResultSourceIds } });
    const r = record(
      '5a',
      'Quizfrage nur OPENED (nicht freigegeben) → collectReleasedQuizSignals',
      {
        friction: ['E', 'F', 'A'],
        clarification: [],
        nextStep: 'controversy',
        attachToCard: false,
        zusatz: { releasedState: 'not-released', insights: 0, limitationCodes: ['not-released'] },
      },
      run,
      {
        releasedState: released.releasedResults.state,
        insights: released.insights.length,
        limitationCodes: released.limitations.map((l) => l.code),
      },
    );
    expect(r.stimmt).toBe(true);
  });

  it('(5b) Gegenprobe: Quizfakt ohne vorgelagertes Gate direkt in den Planner', () => {
    const facts = collectModerationQuizFacts({
      type: 'SINGLE_CHOICE',
      totalVotes: 40,
      correctVoterCount: 12,
      incorrectVoterCount: 28,
      voteDistribution: [
        { text: 'richtig', isCorrect: true, voteCount: 12 },
        { text: 'falsch', isCorrect: false, voteCount: 28 },
      ],
    });
    const quizSource = 'quiz-result:quiz-question.99999999-9999-4999-8999-999999999999:fact.0';
    const run = runRegelkern(P, fixture.fragen, {
      planExtras: { quizResultSourceIds: facts.length > 0 ? [quizSource] : [], quizInsightKind: 'scorable' },
    });
    const r = record(
      '5b',
      'Quizfakt (nicht freigegeben) direkt an planModerationCompass',
      {
        friction: ['E', 'F', 'A'],
        clarification: [quizSource],
        nextStep: 'quiz-confusion',
        attachToCard: true,
        zusatz: { factTypes: ['wrong-majority'] },
      },
      run,
      { factTypes: facts.map((f) => f.type).filter((t) => t === 'wrong-majority') },
      'Synthetische Quellen-ID; Fakttypen auf wrong-majority gefiltert (weitere Fakten wie wrong-option sind für die Aussage unerheblich).',
    );
    expect(r.stimmt).toBe(true);
  });

  afterAll(() => {
    const fmtList = (v: string[]) => (v.length ? v.join(', ') : '—');
    const lines: string[] = [
      '# 2A · Gegenfälle zum Regelkern (Schritt 3.2)',
      '',
      `- Erzeugt: ${new Date().toISOString()}`,
      '- Produktcode = Referenz-Commit `efd71b44`; Harness `referat/2a/gegenfaelle.test.ts` (Erwartungen dort als Kopfkommentar, vor der Ausführung notiert)',
      '- Aufruf: `REFERAT_WRITE_EVIDENCE=1 npx vitest run --config referat/2a/vitest.config.ts gegenfaelle`',
      `- Basis: Sechs-Fragen-Szenario, P = ${P} (T = 5); Fall 0 = Baseline aus 3.1`,
      '- Fall 5a ruft die echte Freigabeprüfung `collectReleasedQuizSignals` (apps/backend/src/lib/moderationTeachingSignals.ts) auf; ohne COMPLETED-Eintrag erfolgt kein DB-Zugriff (tx ist ein werfender Proxy).',
      '',
      '| Fall | Beschreibung | Erwartung (Reibung · Klärung · nächster Schritt) | Ist (Reibung · Klärung · nächster Schritt) | Ergebnis |',
      '| ---- | ------------ | ------------------------------------------------ | ------------------------------------------ | -------- |',
      ...ergebnisse.map(
        (e) =>
          `| ${e.id} | ${e.titel} | ${fmtList(e.erwartung.friction)} · ${fmtList(e.erwartung.clarification)} · ${e.erwartung.nextStep ?? '—'}${e.erwartung.attachToCard === undefined ? '' : ` (attach=${e.erwartung.attachToCard})`} | ${fmtList(e.ist.friction)} · ${fmtList(e.ist.clarification)} · ${e.ist.nextStep ?? '—'} (attach=${e.ist.attachToCard}) | ${e.stimmt ? '✅ wie erwartet' : '⚠️ **Abweichung**'} |`,
      ),
      '',
      '## Details je Fall',
      '',
      ...ergebnisse.flatMap((e) => [
        `### Fall ${e.id} – ${e.titel}`,
        '',
        `- Karten: ${cardsLabel(e.run.cards)}`,
        `- Badges: ${e.run.questions.map((q) => `${q.key}=${q.badge}${q.status !== 'ACTIVE' ? ` (${q.status})` : ''}`).join(', ')}`,
        ...(e.erwartung.zusatz
          ? [
              `- Zusatz erwartet: \`${JSON.stringify(e.erwartung.zusatz)}\``,
              `- Zusatz ist: \`${JSON.stringify(e.ist.zusatz)}\``,
            ]
          : []),
        ...(e.notiz ? [`- Notiz: ${e.notiz}`] : []),
        `- Ergebnis: ${e.stimmt ? 'wie erwartet' : '**Abweichung**'}`,
        '',
      ]),
    ];
    if (WRITE_EVIDENCE) {
      mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(path.join(OUT_DIR, 'gegenfaelle.md'), lines.join('\n'));
      writeFileSync(
        path.join(OUT_DIR, 'gegenfaelle.json'),
        `${JSON.stringify({ schritt: '3.2', P, ergebnisse }, null, 2)}\n`,
      );
    }
  });
});
