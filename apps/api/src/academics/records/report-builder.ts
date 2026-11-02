/**
 * Report card arithmetic, following the school's P1A bulletin:
 *
 *   - Every subject has one report maximum. TJ (travaux journaliers, filled by
 *     quizzes and homework) is out of it, EXAM is out of it, and the subject
 *     total is out of twice it.
 *   - A teacher's assessments are scaled into those columns: the marks of all
 *     quizzes and homework for the subject are summed and scaled to the TJ
 *     maximum; exams likewise to the EXAM maximum.
 *   - A blank is a zero, as on the paper sheet — but every cell that had to be
 *     zeroed or guessed is flagged so the dean decides before printing.
 *   - Percentage is total over the sum of maxima. Place is competition rank on
 *     the total (equal totals share a place, the next place is skipped).
 *
 * Pure functions with no database access, so the rules can be tested alone.
 */

export type ReportKind = 'mid_term' | 'end_of_term' | 'end_of_year';
export type Category = 'quiz' | 'homework' | 'exam';

export interface ReportSubject {
  id: number;
  name: string;
  code: string;
  group: string | null;
  max: number | null;
}

export interface ReportAssessment {
  id: number;
  subject_id: number;
  category: Category;
  title: string;
  max_score: number;
}

export interface ReportMark {
  assessment_id: number;
  student_id: number;
  score: number | null;
  is_absent: boolean;
}

export interface CellFlag {
  code: 'no_cat' | 'no_exam' | 'missing_mark' | 'absent' | 'term_missing' | 'term_incomplete';
  message: string;
}

export interface ReportCell {
  value: number | null;
  max: number | null;
  flags: CellFlag[];
}

export interface TermSubjectResult {
  subject_id: number;
  tj: ReportCell;
  exam: ReportCell | null;
  tot: ReportCell;
}

const round1 = (n: number) => Math.round((n + Number.EPSILON) * 10) / 10;
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function scaleColumn(
  assessments: ReportAssessment[],
  marks: Map<string, ReportMark>,
  studentId: number,
  columnMax: number | null,
  emptyFlag: CellFlag,
): ReportCell {
  if (columnMax === null) return { value: null, max: null, flags: [] };
  if (!assessments.length) return { value: 0, max: columnMax, flags: [emptyFlag] };

  const flags: CellFlag[] = [];
  let scored = 0;
  let possible = 0;
  for (const a of assessments) {
    possible += a.max_score;
    const mark = marks.get(`${a.id}:${studentId}`);
    if (!mark || (!mark.is_absent && mark.score === null)) {
      flags.push({ code: 'missing_mark', message: `No mark for "${a.title}"` });
      continue;
    }
    if (mark.is_absent) {
      flags.push({ code: 'absent', message: `Absent for "${a.title}"` });
      continue;
    }
    scored += mark.score as number;
  }
  const value = possible > 0 ? round1((scored / possible) * columnMax) : 0;
  return { value: Math.min(value, columnMax), max: columnMax, flags };
}

/** One student's TJ / EXAM / TOT for every subject in one term. */
export function computeTermSubjects(
  kind: 'mid_term' | 'end_of_term',
  subjects: ReportSubject[],
  assessments: ReportAssessment[],
  marks: Map<string, ReportMark>,
  studentId: number,
): TermSubjectResult[] {
  return subjects.map((subject) => {
    const own = assessments.filter((a) => a.subject_id === subject.id);
    const tj = scaleColumn(
      own.filter((a) => a.category === 'quiz' || a.category === 'homework'),
      marks, studentId, subject.max,
      { code: 'no_cat', message: 'No quiz or homework submitted' },
    );

    if (kind === 'mid_term') {
      return { subject_id: subject.id, tj, exam: null, tot: { value: tj.value, max: tj.max, flags: [] } };
    }

    const exam = scaleColumn(
      own.filter((a) => a.category === 'exam'),
      marks, studentId, subject.max,
      { code: 'no_exam', message: 'No exam submitted' },
    );
    const tot: ReportCell = subject.max === null
      ? { value: null, max: null, flags: [] }
      : { value: round1((tj.value ?? 0) + (exam.value ?? 0)), max: subject.max * 2, flags: [] };
    return { subject_id: subject.id, tj, exam, tot };
  });
}

export function sumCells(cells: ReportCell[]): { total: number; max: number } {
  let total = 0;
  let max = 0;
  for (const c of cells) {
    if (c.value !== null) total += c.value;
    if (c.max !== null) max += c.max;
  }
  return { total: round1(total), max: round1(max) };
}

export function percentageOf(total: number, max: number): number | null {
  if (max <= 0) return null;
  return round2(Math.min(100, (total / max) * 100));
}

/** Competition ranking on totals, best first: 90, 90, 80 → 1, 1, 3. */
export function rankTotals(entries: { id: number; total: number | null }[]): Map<number, number> {
  const graded = entries
    .filter((e) => e.total !== null)
    .sort((a, b) => (b.total as number) - (a.total as number));
  const positions = new Map<number, number>();
  let previous: number | null = null;
  let previousPosition = 0;
  graded.forEach((e, index) => {
    const position = previous !== null && e.total === previous ? previousPosition : index + 1;
    positions.set(e.id, position);
    previous = e.total;
    previousPosition = position;
  });
  return positions;
}

export function countFlaggedCells(cells: ReportCell[]): number {
  return cells.filter((c) => c.flags.length > 0).length;
}
