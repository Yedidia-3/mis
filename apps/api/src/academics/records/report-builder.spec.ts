import {
  computeTermSubjects, countFlaggedCells, percentageOf, rankTotals, ReportAssessment, ReportMark, sumCells,
} from './report-builder';
import { bandOf } from './school-band';

const subjects = [
  { id: 1, name: 'Maths', code: 'MATH', group: null, max: 70 },
  { id: 2, name: 'EPS', code: 'EPS', group: null, max: 5 },
];

const assessments: ReportAssessment[] = [
  { id: 10, subject_id: 1, category: 'quiz', title: 'Quiz 1', max_score: 20 },
  { id: 11, subject_id: 1, category: 'homework', title: 'Homework 1', max_score: 10 },
  { id: 12, subject_id: 1, category: 'exam', title: 'Exam', max_score: 50 },
];

function marks(list: [number, number, number | null, boolean?][]) {
  const map = new Map<string, ReportMark>();
  for (const [assessment_id, student_id, score, is_absent] of list) {
    map.set(`${assessment_id}:${student_id}`, { assessment_id, student_id, score, is_absent: !!is_absent });
  }
  return map;
}

describe('computeTermSubjects', () => {
  it('scales quizzes and homework into TJ and exams into EXAM out of the subject maximum', () => {
    const [maths] = computeTermSubjects('end_of_term', subjects, assessments, marks([[10, 1, 15], [11, 1, 6], [12, 1, 40]]), 1);
    // (15 + 6) / 30 × 70 = 49; 40 / 50 × 70 = 56
    expect(maths.tj).toEqual({ value: 49, max: 70, flags: [] });
    expect(maths.exam).toEqual({ value: 56, max: 70, flags: [] });
    expect(maths.tot).toEqual({ value: 105, max: 140, flags: [] });
  });

  it('counts a missing or absent mark as zero and flags it', () => {
    const [maths] = computeTermSubjects('end_of_term', subjects, assessments, marks([[10, 1, 20], [11, 1, null, true]]), 1);
    expect(maths.tj.value).toBe(46.7);
    expect(maths.tj.flags.map((f) => f.code)).toEqual(['absent']);
    expect(maths.exam?.value).toBe(0);
    expect(maths.exam?.flags.map((f) => f.code)).toEqual(['missing_mark']);
  });

  it('flags a subject with no assessments at all', () => {
    const [, eps] = computeTermSubjects('end_of_term', subjects, assessments, marks([]), 1);
    expect(eps.tj.flags[0].code).toBe('no_cat');
    expect(eps.exam?.flags[0].code).toBe('no_exam');
    expect(eps.tot).toEqual({ value: 0, max: 10, flags: [] });
  });

  it('leaves the exam out of a mid-term report', () => {
    const [maths] = computeTermSubjects('mid_term', subjects, assessments, marks([[10, 1, 10], [11, 1, 5]]), 1);
    expect(maths.exam).toBeNull();
    expect(maths.tot).toEqual({ value: 35, max: 70, flags: [] });
  });

  it('produces no value when the subject has no report maximum', () => {
    const [maths] = computeTermSubjects('end_of_term', [{ ...subjects[0], max: null }], assessments, marks([[10, 1, 15]]), 1);
    expect(maths.tot).toEqual({ value: null, max: null, flags: [] });
  });
});

describe('totals and ranking', () => {
  it('sums cells and computes a capped percentage', () => {
    const cells = [{ value: 105, max: 140, flags: [] }, { value: 7.5, max: 10, flags: [{ code: 'absent' as const, message: '' }] }];
    expect(sumCells(cells)).toEqual({ total: 112.5, max: 150 });
    expect(percentageOf(112.5, 150)).toBe(75);
    expect(percentageOf(1, 0)).toBeNull();
    expect(countFlaggedCells(cells)).toBe(1);
  });

  it('ranks with shared places for equal totals', () => {
    const ranks = rankTotals([{ id: 1, total: 80 }, { id: 2, total: 90 }, { id: 3, total: 90 }, { id: 4, total: 70 }]);
    expect([ranks.get(2), ranks.get(3), ranks.get(1), ranks.get(4)]).toEqual([1, 1, 3, 4]);
  });
});

describe('bandOf', () => {
  it.each([
    ['N1', 'nursery'], ['KG2', 'nursery'], ['P1', 'lower_primary'], ['p 3', 'lower_primary'],
    ['P4', 'upper_primary'], ['P6', 'upper_primary'], ['S1', null], ['P7', null],
  ])('%s → %s', (name, band) => {
    expect(bandOf(name)).toBe(band);
  });
});
