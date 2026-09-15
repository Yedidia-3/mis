/**
 * Turning recorded marks into the grades that appear on a report card.
 *
 * Pure functions, free of entities and database access, because this is the
 * arithmetic a parent will query and a teacher will be held to. It has to be
 * inspectable and testable on its own.
 */

/** One student's mark on one assessment. `score: null` means absent. */
export interface ScoredAssessment {
  assessmentTypeId: number;
  score: number | null;
  maxScore: number;
}

/** An assessment type's share of the subject grade, as set by the dean. */
export interface TypeWeight {
  assessmentTypeId: number;
  weight: number;
}

export interface SubjectGrade {
  /** Weighted percentage, or null when there is nothing to grade. */
  percentage: number | null;
  /** Which types actually contributed, after absences and empty types dropped out. */
  contributingTypeIds: number[];
}

/** Rounds to two decimals without accumulating binary float drift. */
const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Average one type's assessments as a percentage.
 *
 * Absences are skipped rather than counted as zero — a child who was ill did
 * not score nothing, and treating it as zero would quietly punish them.
 * Returns null when nothing in this type was actually sat.
 */
function averageTypePercentage(assessments: ScoredAssessment[]): number | null {
  const sat = assessments.filter(
    (a) => a.score !== null && a.maxScore > 0,
  );
  if (!sat.length) return null;

  const total = sat.reduce((sum, a) => sum + (a.score as number) / a.maxScore, 0);
  return (total / sat.length) * 100;
}

/**
 * Compute one student's grade in one subject for one term.
 *
 * Types with no sat assessments are excluded and the remaining weights are
 * rescaled to fill 100%. Without that, a term where the exam has not happened
 * yet would show every child failing — the missing 50% would read as zero
 * rather than as "not assessed".
 */
export function computeSubjectGrade(
  assessments: ScoredAssessment[],
  weights: TypeWeight[],
): SubjectGrade {
  const byType = new Map<number, ScoredAssessment[]>();
  for (const a of assessments) {
    const list = byType.get(a.assessmentTypeId);
    if (list) list.push(a);
    else byType.set(a.assessmentTypeId, [a]);
  }

  const contributions: { typeId: number; percentage: number; weight: number }[] = [];
  for (const { assessmentTypeId, weight } of weights) {
    if (weight <= 0) continue;
    const typeAssessments = byType.get(assessmentTypeId);
    if (!typeAssessments) continue;

    const percentage = averageTypePercentage(typeAssessments);
    if (percentage === null) continue;

    contributions.push({ typeId: assessmentTypeId, percentage, weight });
  }

  const weightTotal = contributions.reduce((sum, c) => sum + c.weight, 0);
  if (!contributions.length || weightTotal <= 0) {
    return { percentage: null, contributingTypeIds: [] };
  }

  const weighted = contributions.reduce(
    (sum, c) => sum + c.percentage * (c.weight / weightTotal),
    0,
  );

  return {
    percentage: round2(weighted),
    contributingTypeIds: contributions.map((c) => c.typeId),
  };
}

/**
 * Mean of a student's subject grades. Subjects with no grade are ignored, so a
 * subject that has not been assessed yet does not drag the average down.
 */
export function computeOverallAverage(subjectGrades: (number | null)[]): number | null {
  const graded = subjectGrades.filter((g): g is number => g !== null);
  if (!graded.length) return null;
  return round2(graded.reduce((sum, g) => sum + g, 0) / graded.length);
}

export interface RankedStudent<T> {
  student: T;
  average: number | null;
  /** 1-based position; null when the student has no grade to rank on. */
  position: number | null;
}

/**
 * Order students by average, best first, assigning positions.
 *
 * Ties share a position and the next position skips accordingly (80, 80, 75 →
 * 1st, 1st, 3rd), which is how schools report joint placings. Ungraded
 * students sort last and take no position rather than being ranked bottom.
 */
export function rankByAverage<T>(
  entries: { student: T; average: number | null }[],
): RankedStudent<T>[] {
  const graded = entries
    .filter((e) => e.average !== null)
    .sort((a, b) => (b.average as number) - (a.average as number));
  const ungraded = entries.filter((e) => e.average === null);

  const ranked: RankedStudent<T>[] = [];
  let previousAverage: number | null = null;
  let previousPosition = 0;

  graded.forEach((entry, index) => {
    const position =
      previousAverage !== null && entry.average === previousAverage
        ? previousPosition
        : index + 1;

    ranked.push({ student: entry.student, average: entry.average, position });
    previousAverage = entry.average;
    previousPosition = position;
  });

  for (const entry of ungraded) {
    ranked.push({ student: entry.student, average: null, position: null });
  }

  return ranked;
}

export interface AssessmentAnalytics {
  average: number | null;
  highest: number | null;
  lowest: number | null;
  /** How many students have a mark recorded, out of how many are enrolled. */
  recorded: number;
  total: number;
  absent: number;
}

/**
 * The summary cards on the dean's and principal's review page.
 *
 * `recorded` versus `total` matters: without it, an assessment where only five
 * of thirty children have been entered looks like a catastrophic class average
 * rather than an unfinished one.
 */
export function summariseAssessment(
  scores: { score: number | null; is_absent: boolean }[],
  maxScore: number,
  enrolledCount: number,
): AssessmentAnalytics {
  const marked = scores.filter((s) => s.score !== null && !s.is_absent);
  const absent = scores.filter((s) => s.is_absent).length;

  if (!marked.length || maxScore <= 0) {
    return {
      average: null,
      highest: null,
      lowest: null,
      recorded: marked.length,
      total: enrolledCount,
      absent,
    };
  }

  const percentages = marked.map((s) => ((s.score as number) / maxScore) * 100);

  return {
    average: round2(percentages.reduce((a, b) => a + b, 0) / percentages.length),
    highest: round2(Math.max(...percentages)),
    lowest: round2(Math.min(...percentages)),
    recorded: marked.length,
    total: enrolledCount,
    absent,
  };
}

// ─── Whole-year performance ──────────────────────────────────────────────────
//
// Terms are independent while they run: a mark recorded in Term 1 can never
// reach a Term 2 grade, because grades are only ever computed from the
// assessments of a single term. The three are joined here and nowhere else.

export interface TermResult {
  termId: number;
  isClosed: boolean;
  /** The term's average — for one subject, or overall. */
  average: number | null;
}

export interface YearPerformance {
  /** Equal mean of the term averages, or null while the year is incomplete. */
  average: number | null;
  isComplete: boolean;
  closedTermCount: number;
  expectedTermCount: number;
}

/**
 * Equal mean of one subject's grade across the terms.
 *
 * Every term must have a grade. A subject taught in only two of three terms
 * has no honest annual figure, and averaging what exists would silently
 * present a two-term result as a full year's work.
 */
export function averageAcrossTerms(termGrades: (number | null)[]): number | null {
  if (!termGrades.length) return null;
  if (termGrades.some((g) => g === null)) return null;

  const grades = termGrades as number[];
  return round2(grades.reduce((sum, g) => sum + g, 0) / grades.length);
}

/**
 * Overall performance for the year — the equal mean of the three term
 * averages, weighting each term the same.
 *
 * Withheld entirely until every term exists and is closed. A figure labelled
 * "year performance" that is really just Term 1 would be read as final by
 * whoever receives it, so it is better to show nothing than something true
 * only in March.
 */
export function computeYearPerformance(
  terms: TermResult[],
  expectedTermCount = 3,
): YearPerformance {
  const closedTermCount = terms.filter((t) => t.isClosed).length;
  const isComplete =
    terms.length === expectedTermCount && closedTermCount === expectedTermCount;

  const base = { isComplete, closedTermCount, expectedTermCount };

  if (!isComplete) return { ...base, average: null };

  return { ...base, average: averageAcrossTerms(terms.map((t) => t.average)) };
}
