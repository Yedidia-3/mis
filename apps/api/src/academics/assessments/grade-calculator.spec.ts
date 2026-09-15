import {
  ScoredAssessment,
  TermResult,
  TypeWeight,
  averageAcrossTerms,
  computeOverallAverage,
  computeSubjectGrade,
  computeYearPerformance,
  rankByAverage,
  summariseAssessment,
} from './grade-calculator';

const QUIZ = 1;
const HOMEWORK = 2;
const EXAM = 3;

/** The school's grading policy: exam 50%, quiz 30%, homework 20%. */
const WEIGHTS: TypeWeight[] = [
  { assessmentTypeId: EXAM, weight: 50 },
  { assessmentTypeId: QUIZ, weight: 30 },
  { assessmentTypeId: HOMEWORK, weight: 20 },
];

const mark = (
  assessmentTypeId: number,
  score: number | null,
  maxScore: number,
): ScoredAssessment => ({ assessmentTypeId, score, maxScore });

describe('computeSubjectGrade', () => {
  it('weights each type by the dean-configured percentage', () => {
    // Quizzes  16/20, 18/20      → 85.00%  × 0.30 = 25.500
    // Homework 9/10, 7/10, 10/10 → 86.67%  × 0.20 = 17.333
    // Exam     71/100            → 71.00%  × 0.50 = 35.500
    //                                              = 78.33
    const result = computeSubjectGrade(
      [
        mark(QUIZ, 16, 20),
        mark(QUIZ, 18, 20),
        mark(HOMEWORK, 9, 10),
        mark(HOMEWORK, 7, 10),
        mark(HOMEWORK, 10, 10),
        mark(EXAM, 71, 100),
      ],
      WEIGHTS,
    );

    expect(result.percentage).toBe(78.33);
    expect(result.contributingTypeIds.sort()).toEqual([QUIZ, HOMEWORK, EXAM].sort());
  });

  it('rescales the remaining weights when a type has no assessments yet', () => {
    // Mid-term: the exam has not happened. Quiz 30 and homework 20 rescale to
    // 60% and 40% rather than the child appearing to have lost the exam's 50%.
    const result = computeSubjectGrade(
      [mark(QUIZ, 17, 20), mark(HOMEWORK, 8, 10)], // 85% and 80%
      WEIGHTS,
    );

    // 85 × 0.6 + 80 × 0.4 = 51 + 32 = 83
    expect(result.percentage).toBe(83);
    expect(result.contributingTypeIds).not.toContain(EXAM);
  });

  it('gives full weight to a single type when it is the only one assessed', () => {
    const result = computeSubjectGrade([mark(QUIZ, 17, 20)], WEIGHTS);

    expect(result.percentage).toBe(85);
    expect(result.contributingTypeIds).toEqual([QUIZ]);
  });

  it('excludes an absence instead of scoring it zero', () => {
    const withAbsence = computeSubjectGrade(
      [mark(QUIZ, 18, 20), mark(QUIZ, null, 20)],
      WEIGHTS,
    );
    const withoutTheAbsentOne = computeSubjectGrade([mark(QUIZ, 18, 20)], WEIGHTS);

    expect(withAbsence.percentage).toBe(90);
    expect(withAbsence.percentage).toBe(withoutTheAbsentOne.percentage);
  });

  it('returns no grade when every assessment was missed', () => {
    const result = computeSubjectGrade(
      [mark(QUIZ, null, 20), mark(EXAM, null, 100)],
      WEIGHTS,
    );

    expect(result.percentage).toBeNull();
    expect(result.contributingTypeIds).toEqual([]);
  });

  it('returns no grade when nothing has been assessed', () => {
    expect(computeSubjectGrade([], WEIGHTS).percentage).toBeNull();
  });

  it('ignores an assessment marked out of zero rather than dividing by it', () => {
    const result = computeSubjectGrade(
      [mark(QUIZ, 0, 0), mark(EXAM, 80, 100)],
      WEIGHTS,
    );

    expect(result.percentage).toBe(80);
    expect(result.contributingTypeIds).toEqual([EXAM]);
  });

  it('ignores a type the dean has given zero weight', () => {
    const result = computeSubjectGrade(
      [mark(QUIZ, 20, 20), mark(EXAM, 50, 100)],
      [
        { assessmentTypeId: EXAM, weight: 100 },
        { assessmentTypeId: QUIZ, weight: 0 },
      ],
    );

    expect(result.percentage).toBe(50);
  });

  it('ignores marks whose type is not in the grading policy', () => {
    const result = computeSubjectGrade(
      [mark(EXAM, 60, 100), mark(999, 100, 100)],
      WEIGHTS,
    );

    expect(result.percentage).toBe(60);
  });
});

describe('computeOverallAverage', () => {
  it('averages the graded subjects', () => {
    expect(computeOverallAverage([80, 70, 90])).toBe(80);
  });

  it('skips subjects that have no grade yet', () => {
    expect(computeOverallAverage([80, null, 90])).toBe(85);
  });

  it('returns null when no subject has been graded', () => {
    expect(computeOverallAverage([null, null])).toBeNull();
    expect(computeOverallAverage([])).toBeNull();
  });
});

describe('rankByAverage', () => {
  it('orders students best first', () => {
    const ranked = rankByAverage([
      { student: 'Uwase', average: 72 },
      { student: 'Mugisha', average: 91 },
      { student: 'Ineza', average: 84 },
    ]);

    expect(ranked.map((r) => r.student)).toEqual(['Mugisha', 'Ineza', 'Uwase']);
    expect(ranked.map((r) => r.position)).toEqual([1, 2, 3]);
  });

  it('gives tied students the same position and skips the next', () => {
    const ranked = rankByAverage([
      { student: 'A', average: 80 },
      { student: 'B', average: 80 },
      { student: 'C', average: 75 },
    ]);

    expect(ranked.map((r) => r.position)).toEqual([1, 1, 3]);
  });

  it('places ungraded students last with no position', () => {
    const ranked = rankByAverage([
      { student: 'Graded', average: 60 },
      { student: 'Ungraded', average: null },
    ]);

    expect(ranked[1].student).toBe('Ungraded');
    expect(ranked[1].position).toBeNull();
    expect(ranked[0].position).toBe(1);
  });

  it('keeps every student, graded or not', () => {
    const ranked = rankByAverage([
      { student: 'A', average: null },
      { student: 'B', average: 50 },
      { student: 'C', average: null },
    ]);

    expect(ranked).toHaveLength(3);
  });
});

describe('summariseAssessment', () => {
  const scored = (score: number | null, is_absent = false) => ({ score, is_absent });

  it('reports average, highest and lowest as percentages', () => {
    const result = summariseAssessment(
      [scored(20), scored(15), scored(10)],
      20,
      3,
    );

    expect(result.average).toBe(75);
    expect(result.highest).toBe(100);
    expect(result.lowest).toBe(50);
  });

  it('distinguishes an unfinished assessment from a disastrous one', () => {
    // Three of thirty entered. Without recorded/total the dean sees only a
    // class average and cannot tell the difference.
    const result = summariseAssessment([scored(18), scored(19), scored(20)], 20, 30);

    expect(result.recorded).toBe(3);
    expect(result.total).toBe(30);
    expect(result.average).toBe(95);
  });

  it('counts absences separately and leaves them out of the average', () => {
    const result = summariseAssessment(
      [scored(20), scored(10), scored(null, true)],
      20,
      3,
    );

    expect(result.absent).toBe(1);
    expect(result.recorded).toBe(2);
    expect(result.average).toBe(75);
  });

  it('returns nulls rather than NaN when nothing is recorded', () => {
    const result = summariseAssessment([], 20, 25);

    expect(result.average).toBeNull();
    expect(result.highest).toBeNull();
    expect(result.lowest).toBeNull();
    expect(result.recorded).toBe(0);
    expect(result.total).toBe(25);
  });

  it('does not divide by a zero max score', () => {
    const result = summariseAssessment([scored(0)], 0, 1);

    expect(result.average).toBeNull();
  });
});

describe('term independence', () => {
  it('grades a term only from that term\'s own marks', () => {
    // The school's rule: Term 1 never affects Term 2 or 3, and vice versa.
    // Grades are computed from whatever assessments are handed in, and the
    // caller passes one term's worth, so a strong Term 1 cannot lift a weak
    // Term 2 no matter how the terms are ordered.
    const termOneMarks = [mark(EXAM, 95, 100)];
    const termTwoMarks = [mark(EXAM, 55, 100)];

    const termOne = computeSubjectGrade(termOneMarks, WEIGHTS);
    const termTwo = computeSubjectGrade(termTwoMarks, WEIGHTS);

    expect(termOne.percentage).toBe(95);
    expect(termTwo.percentage).toBe(55);

    // Recomputing Term 2 after Term 1 exists changes nothing.
    expect(computeSubjectGrade(termTwoMarks, WEIGHTS).percentage).toBe(55);
  });
});

describe('averageAcrossTerms', () => {
  it('weights each term equally', () => {
    expect(averageAcrossTerms([90, 60, 75])).toBe(75);
  });

  it('refuses to average when a term has no grade', () => {
    // Two terms of work is not a year's work, however tempting the number is.
    expect(averageAcrossTerms([90, null, 75])).toBeNull();
  });

  it('returns null for no terms at all', () => {
    expect(averageAcrossTerms([])).toBeNull();
  });
});

describe('computeYearPerformance', () => {
  const term = (termId: number, isClosed: boolean, average: number | null): TermResult =>
    ({ termId, isClosed, average });

  it('averages the three terms equally once the year is complete', () => {
    const result = computeYearPerformance([
      term(1, true, 80),
      term(2, true, 70),
      term(3, true, 90),
    ]);

    expect(result.average).toBe(80);
    expect(result.isComplete).toBe(true);
    expect(result.closedTermCount).toBe(3);
  });

  it('withholds the annual figure while a term is still open', () => {
    const result = computeYearPerformance([
      term(1, true, 80),
      term(2, true, 70),
      term(3, false, 90),
    ]);

    expect(result.average).toBeNull();
    expect(result.isComplete).toBe(false);
    expect(result.closedTermCount).toBe(2);
  });

  it('withholds the annual figure when a term has not been created yet', () => {
    // Mid-year: only Terms 1 and 2 exist. Averaging them would present half a
    // year as the whole of it.
    const result = computeYearPerformance([term(1, true, 80), term(2, true, 70)]);

    expect(result.average).toBeNull();
    expect(result.isComplete).toBe(false);
  });

  it('withholds the annual figure when a closed term has no grade', () => {
    const result = computeYearPerformance([
      term(1, true, 80),
      term(2, true, null),
      term(3, true, 90),
    ]);

    expect(result.average).toBeNull();
    expect(result.isComplete).toBe(true);
  });

  it('still reports progress so the dean can see how far the year has got', () => {
    const result = computeYearPerformance([
      term(1, true, 80),
      term(2, false, null),
      term(3, false, null),
    ]);

    expect(result.closedTermCount).toBe(1);
    expect(result.expectedTermCount).toBe(3);
  });
});
