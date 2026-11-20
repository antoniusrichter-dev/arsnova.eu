/**
 * Versuchscode Referat Thema 2 / Auftrag 2A – kein Produktpfad.
 *
 * Schickt das Sechs-Fragen-Szenario durch die echten Regelfunktionen des
 * Moderationskompasses. Nachgebildet wird nur die Verdrahtung aus
 * apps/backend/src/lib/moderationTeachingSignals.ts → buildCompassContext()
 * (Referenz-Commit efd71b44, Zeilen 1656–1781), beschränkt auf den Q&A-Anteil:
 * keine Themen, keine Quizfakten, kein Blitzlicht, sofern der Aufrufer sie nicht setzt.
 *
 * Echte Produktfunktionen (unverändert importiert):
 *   - resolveQaControversyThreshold, isQaControversialLabel,
 *     isQaControversyInsufficientVotes, resolveQaControversyBadgeKind
 *     (apps/backend/src/lib/qaControversy.ts)
 *   - selectPendingModerationQuestionSourceIds, selectFrictionQuestionSourceIds,
 *     planModerationCompass (libs/shared-types/src/moderation-compass-rules.ts)
 *
 * Nachgerechnet (SQL lässt sich ohne DB nicht aufrufen):
 *   - bestScore und controversyScore exakt wie buildQaRankingScoreSelectSql()
 *     in apps/backend/src/lib/qaRankingSql.ts (DOUBLE PRECISION ↔ JS-Number).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  isQaControversialLabel,
  isQaControversyInsufficientVotes,
  resolveQaControversyBadgeKind,
  resolveQaControversyThreshold,
  type QaControversyBadgeKind,
} from '../../../apps/backend/src/lib/qaControversy';
import {
  MODERATION_COMPASS_RULES_VERSION,
  planModerationCompass,
  selectFrictionQuestionSourceIds,
  selectPendingModerationQuestionSourceIds,
  type ModerationCompassPlanInput,
  type ModerationCompassRulePlan,
  type ModerationCompassSortMode,
} from '../../../libs/shared-types/src/moderation-compass-rules';

export const REPO_ROOT = path.resolve(__dirname, '../../..');
export const FIXTURE_PATH = path.join(REPO_ROOT, 'referat/fixtures/sechs-fragen-szenario.json');

export type QuestionStatus = 'PENDING' | 'ACTIVE' | 'PINNED' | 'ARCHIVED' | 'DELETED';

export type FixtureQuestion = {
  key: string;
  sourceId: string;
  text: string;
  status: QuestionStatus;
  /** null = Stimmen nicht verfügbar (votes.state !== 'available' im Kontext). */
  positive: number | null;
  negative: number | null;
};

export type Fixture = {
  fixtureId: string;
  raumgroessen: number[];
  fragen: FixtureQuestion[];
};

export function loadFixture(): Fixture {
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as Fixture;
}

// ---- qaRankingSql.ts, 1:1 nachgerechnet ------------------------------------
const QA_WILSON_Z = 1.96;
const QA_WILSON_Z_SQUARED = QA_WILSON_Z * QA_WILSON_Z;

/** bestScore: CASE n=0 → 0, sonst GREATEST(0, LEAST(1, Wilson-Untergrenze)). */
export function sqlBestScore(positive: number, negative: number): number {
  const n = positive + negative;
  if (n === 0) return 0;
  const p = positive / n;
  const wilson =
    (p +
      QA_WILSON_Z_SQUARED / (2 * n) -
      QA_WILSON_Z * Math.sqrt((p * (1 - p)) / n + QA_WILSON_Z_SQUARED / (4 * Math.pow(n, 2)))) /
    (1 + QA_WILSON_Z_SQUARED / n);
  return Math.max(0, Math.min(1, wilson));
}

/** controversyScore: CASE n=0 → 0, sonst LEAST(1, 2·LEAST(p,n) / (p + n + T)). */
export function sqlControversyScore(positive: number, negative: number, threshold: number): number {
  if (positive + negative === 0) return 0;
  return Math.min(1, (2 * Math.min(positive, negative)) / (positive + negative + threshold));
}
// ----------------------------------------------------------------------------

export type QuestionResult = {
  key: string;
  sourceId: string;
  status: QuestionStatus;
  positive: number | null;
  negative: number | null;
  total: number;
  votesAvailable: boolean;
  bestScore: number;
  controversyScore: number;
  isControversial: boolean;
  insufficientVotes: boolean;
  badge: QaControversyBadgeKind;
};

export type CardResult = {
  kind: string;
  tone: string;
  sourceIds: string[];
  sourceKeys: string[];
  nextStepReason: string | null;
};

export type RunResult = {
  P: number;
  T: number;
  rulesVersion: typeof MODERATION_COMPASS_RULES_VERSION;
  questions: QuestionResult[];
  pendingQuestionSourceIds: string[];
  frictionQuestionSourceIds: string[];
  cards: CardResult[];
  recommendation: ModerationCompassRulePlan['recommendation'];
  nextStep: string | null;
  sourceKeys: string[];
};

export type RunOptions = {
  sortMode?: ModerationCompassSortMode;
  /** Zusatzeingänge für den Planner (z. B. Quizfakten in Gegenfall 5). */
  planExtras?: Partial<
    Pick<ModerationCompassPlanInput, 'quizResultSourceIds' | 'mentionQuizSourceIds' | 'quizInsightKind'>
  >;
};

/**
 * Status, die der Kandidatenkorpus lädt: moderationQaContext.ts → loadQaCandidateRows
 * filtert `status IN ('PENDING','ACTIVE','PINNED')`. ARCHIVED/DELETED erreichen die
 * Regelschicht im Releasepfad also gar nicht.
 */
export const CANDIDATE_STATUSES: readonly QuestionStatus[] = ['PENDING', 'ACTIVE', 'PINNED'];

export function runRegelkern(
  P: number,
  fragen: readonly FixtureQuestion[],
  options: RunOptions & { applyCandidateFilter?: boolean } = {},
): RunResult {
  const T = resolveQaControversyThreshold(P);
  const corpus =
    options.applyCandidateFilter === false
      ? fragen
      : fragen.filter((q) => CANDIDATE_STATUSES.includes(q.status));

  const questions: QuestionResult[] = corpus.map((q) => {
    const votesAvailable = q.positive !== null && q.negative !== null;
    const positive = q.positive ?? 0;
    const negative = q.negative ?? 0;
    const total = votesAvailable ? positive + negative : 0;
    // buildCompassContext: fehlende Stimmen → controversyScore 0, total 0.
    const controversyScore = votesAvailable ? sqlControversyScore(positive, negative, T) : 0;
    const bestScore = votesAvailable ? sqlBestScore(positive, negative) : 0;
    const isControversial = isQaControversialLabel({
      controversyScore,
      voteCount: total,
      controversyThreshold: T,
    });
    const insufficientVotes = isQaControversyInsufficientVotes({
      voteCount: total,
      controversyThreshold: T,
      isControversial,
    });
    return {
      key: q.key,
      sourceId: q.sourceId,
      status: q.status,
      positive: q.positive,
      negative: q.negative,
      total,
      votesAvailable,
      bestScore,
      controversyScore,
      isControversial,
      insufficientVotes,
      badge: resolveQaControversyBadgeKind({
        isControversial,
        controversyInsufficientVotes: insufficientVotes,
      }),
    };
  });

  const ruleQuestions = questions.map((q) => ({
    sourceId: q.sourceId,
    status: q.status,
    positiveVoteCount: q.votesAvailable ? (q.positive ?? 0) : 0,
    negativeVoteCount: q.votesAvailable ? (q.negative ?? 0) : 0,
    score: q.votesAvailable ? (q.positive ?? 0) - (q.negative ?? 0) : 0,
    bestScore: q.bestScore,
    controversyScore: q.controversyScore,
    isControversial: q.isControversial,
  }));

  const pendingQuestionSourceIds = selectPendingModerationQuestionSourceIds(
    ruleQuestions,
    options.sortMode,
  );
  const frictionQuestionSourceIds = selectFrictionQuestionSourceIds(
    ruleQuestions.filter((q) => q.status !== 'PENDING'),
  );

  const plan = planModerationCompass({
    topicSourceIds: [],
    pendingQuestionSourceIds,
    frictionQuestionSourceIds,
    quizResultSourceIds: options.planExtras?.quizResultSourceIds ?? [],
    mentionQuizSourceIds: options.planExtras?.mentionQuizSourceIds ?? [],
    quizInsightKind: options.planExtras?.quizInsightKind ?? null,
    feedback: null,
  });

  const keyBySourceId = new Map(fragen.map((q) => [q.sourceId, q.key]));
  const toKeys = (ids: readonly string[]) => ids.map((id) => keyBySourceId.get(id) ?? id);
  const cards: CardResult[] = plan.cards.map((card) => ({
    kind: card.kind,
    tone: card.tone,
    sourceIds: [...card.sourceIds],
    sourceKeys: toKeys(card.sourceIds),
    nextStepReason: card.nextStepReason ?? null,
  }));

  return {
    P,
    T,
    rulesVersion: plan.rulesVersion,
    questions,
    pendingQuestionSourceIds,
    frictionQuestionSourceIds,
    cards,
    recommendation: plan.recommendation,
    nextStep: plan.recommendation?.reason ?? null,
    sourceKeys: [...new Set(cards.flatMap((card) => card.sourceKeys))],
  };
}

export function fmt(value: number, digits = 4): string {
  return value.toFixed(digits).replace('.', ',');
}

export function cardsLabel(cards: readonly CardResult[]): string {
  if (cards.length === 0) return '— (keine Karte)';
  return cards
    .map(
      (card) =>
        `${card.kind}/${card.tone} [${card.sourceKeys.join(', ')}]` +
        (card.nextStepReason ? ` ⇒ ${card.nextStepReason}` : ''),
    )
    .join('; ');
}
