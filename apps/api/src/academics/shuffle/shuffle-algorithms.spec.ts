import {
  Assignment,
  MarkedStudent,
  applyAlgorithm,
  balancedAverage,
  balancedBands,
  roundRobin,
  snakeDraft,
  summariseBalance,
} from './shuffle-algorithms';

interface TestStudent {
  id: number;
  mark: number;
}
interface TestClass {
  id: number;
  name: string;
}

/** Students with the given marks, in no particular order. */
const cohort = (...marks: number[]): MarkedStudent<TestStudent>[] =>
  marks.map((mark, i) => ({ student: { id: i + 1, mark }, mark }));

/** A cohort of n students with evenly descending marks, best first. */
const evenCohort = (n: number): MarkedStudent<TestStudent>[] =>
  cohort(...Array.from({ length: n }, (_, i) => 100 - i));

const classes = (...names: string[]): TestClass[] =>
  names.map((name, i) => ({ id: i + 1, name }));

const sizes = (
  assignments: Assignment<TestStudent, TestClass>[],
  cls: TestClass[],
): number[] => cls.map((c) => assignments.filter((a) => a.classObj.id === c.id).length);

const averages = (
  assignments: Assignment<TestStudent, TestClass>[],
  cls: TestClass[],
): number[] =>
  cls.map((c) => {
    const mine = assignments.filter((a) => a.classObj.id === c.id);
    if (!mine.length) return 0;
    return mine.reduce((sum, a) => sum + a.student.mark, 0) / mine.length;
  });

const spread = (nums: number[]) => Math.max(...nums) - Math.min(...nums);

const ALGORITHMS = [
  ['balancedAverage', balancedAverage],
  ['roundRobin', roundRobin],
  ['snakeDraft', snakeDraft],
  ['balancedBands', balancedBands],
] as const;

describe('shuffle algorithms', () => {
  // Hold for every algorithm. A violation means a child was dropped,
  // duplicated, or put somewhere that does not exist.
  describe.each(ALGORITHMS)('%s — universal invariants', (_name, algorithm) => {
    it('assigns every student exactly once', () => {
      const students = evenCohort(37);
      const cls = classes('A', 'B', 'C', 'D');

      const result = algorithm(students, cls);
      const ids = result.map((a) => a.student.id).sort((x, y) => x - y);

      expect(result).toHaveLength(students.length);
      expect(ids).toEqual(students.map((s) => s.student.id).sort((x, y) => x - y));
    });

    it('only ever assigns to one of the provided classes', () => {
      const cls = classes('A', 'B', 'C');
      const valid = cls.map((c) => c.id);

      for (const { classObj } of algorithm(evenCohort(20), cls)) {
        expect(valid).toContain(classObj.id);
      }
    });

    it('keeps class sizes within one of each other', () => {
      // Room capacity is a physical constraint and is never traded away for a
      // better spread of marks.
      const cls = classes('A', 'B', 'C');
      expect(spread(sizes(algorithm(evenCohort(50), cls), cls))).toBeLessThanOrEqual(1);
    });

    it('never leaves a class empty when there are students to go round', () => {
      // 4 students across 3 classes used to yield 2, 2, 0.
      const cls = classes('A', 'B', 'C');
      expect(Math.min(...sizes(algorithm(evenCohort(4), cls), cls))).toBeGreaterThan(0);
    });

    it('puts everyone in the only class when there is just one', () => {
      const cls = classes('A');
      expect(sizes(algorithm(evenCohort(12), cls), cls)).toEqual([12]);
    });

    it('returns nothing for an empty cohort rather than throwing', () => {
      expect(algorithm([], classes('A', 'B'))).toEqual([]);
    });

    it('is deterministic — the same input gives the same classes', () => {
      const students = cohort(88, 61, 74, 95, 52, 70, 63, 81);
      const cls = classes('A', 'B', 'C');

      const first = algorithm(students, cls).map((a) => [a.student.id, a.classObj.id]);
      const second = algorithm(students, cls).map((a) => [a.student.id, a.classObj.id]);

      expect(first).toEqual(second);
    });

    it('judges students by mark, not by the order they arrive in', () => {
      const cls = classes('A', 'B');
      const ascending = cohort(50, 60, 70, 80, 90, 100);
      const descending = cohort(100, 90, 80, 70, 60, 50);

      // Same marks, opposite input order — the resulting class averages match.
      expect(averages(algorithm(ascending, cls), cls).sort()).toEqual(
        averages(algorithm(descending, cls), cls).sort(),
      );
    });
  });

  describe('balancedAverage', () => {
    it('brings the class averages close together', () => {
      const cls = classes('A', 'B', 'C');
      const students = cohort(98, 91, 84, 79, 75, 70, 66, 60, 55, 48, 40, 31);

      const result = balancedAverage(students, cls);

      // Totals land at 271 / 266 / 260 — averages of 67.75, 66.5 and 65.
      //
      // Dealing the strongest remaining student to the weakest class is a
      // greedy rule, not an exhaustive search, so it gets close rather than
      // exactly equal. Within a few points is what matters here, and being
      // deterministic and explainable matters more than the last decimal —
      // the dean has to be able to justify a placement to a parent.
      expect(spread(averages(result, cls))).toBeLessThan(3);
      expect(sizes(result, cls)).toEqual([4, 4, 4]);
    });

    it('is dramatically fairer than round robin on the same cohort', () => {
      const cls = classes('A', 'B', 'C');
      const students = cohort(98, 91, 84, 79, 75, 70, 66, 60, 55, 48, 40, 31);

      // Round robin hands class A every 1st, 4th, 7th and 10th best student,
      // which stacks the strong ones: a spread of about 12 points.
      const balanced = spread(averages(balancedAverage(students, cls), cls));
      const naive = spread(averages(roundRobin(students, cls), cls));

      expect(balanced).toBeLessThan(naive / 3);
    });

    it('beats round robin at equalising averages', () => {
      const cls = classes('A', 'B', 'C');
      const students = evenCohort(30);

      expect(spread(averages(balancedAverage(students, cls), cls)))
        .toBeLessThanOrEqual(spread(averages(roundRobin(students, cls), cls)));
    });

    it('gives the strongest student to a different class than the second', () => {
      // The whole point: the best students are spread, not stacked.
      const cls = classes('A', 'B', 'C');
      const result = balancedAverage(cohort(100, 99, 98), cls);

      const placed = result.map((a) => a.classObj.id);
      expect(new Set(placed).size).toBe(3);
    });

    it('equalises averages even when classes must differ in size', () => {
      // 13 students across 3 classes means one class holds 5 and the others 4.
      // Balancing class *totals* would leave the 5-student class a whole grade
      // lower on average — averages are what the school asked to equalise, so
      // the larger class is aimed at a proportionally larger total.
      const cls = classes('A', 'B', 'C');
      const students = cohort(98, 91, 84, 79, 75, 70, 66, 60, 55, 48, 40, 31, 0);

      const result = balancedAverage(students, cls);

      expect(sizes(result, cls).sort()).toEqual([4, 4, 5]);
      expect(spread(averages(result, cls))).toBeLessThan(3);
    });

    it('compensates a zero-mark student as far as the numbers allow', () => {
      // A missing mark counts as zero, and in a small cohort that is expensive
      // in a way no algorithm can undo. Eight students over two classes of
      // four: whichever class takes the zero can at best hold the top three
      // alongside it — 80+78+76 = 234, averaging 58.5 — while the other holds
      // 74+72+70+68, averaging 71. A spread of 12.5 is the arithmetic floor,
      // not a shortcoming of the algorithm.
      //
      // Worth knowing when deciding whether a blank mark should mean zero: the
      // cost lands on the classmates of the child with the missing data.
      const cls = classes('A', 'B');
      const students = cohort(80, 78, 76, 74, 72, 70, 68, 0);

      const result = balancedAverage(students, cls);
      const [low, high] = averages(result, cls).sort((a, b) => a - b);

      expect(low).toBeCloseTo(58.5, 1);
      expect(high).toBeCloseTo(71, 1);
    });

    it('absorbs a zero comfortably once the cohort is a realistic size', () => {
      // The same zero costs almost nothing spread across three full classes.
      const cls = classes('A', 'B', 'C');
      const students = cohort(
        92, 88, 85, 81, 78, 76, 74, 72, 70, 68, 66, 64, 61, 58, 55, 52, 48, 40, 33, 0,
      );

      expect(spread(averages(balancedAverage(students, cls), cls))).toBeLessThan(2);
    });

    it('handles every student having the same mark', () => {
      const cls = classes('A', 'B');
      const result = balancedAverage(cohort(70, 70, 70, 70), cls);

      expect(sizes(result, cls)).toEqual([2, 2]);
      expect(spread(averages(result, cls))).toBe(0);
    });
  });

  describe('missing marks count as zero', () => {
    // The school's rule: a blank mark on import is treated as a score of
    // nothing, so the student sorts last and lands in the weakest group.
    it('sorts a student with no mark below everyone who has one', () => {
      const cls = classes('A', 'B');
      const students = cohort(90, 80, 70, 0); // the 0 is the missing mark

      const result = balancedAverage(students, cls);
      const weakest = result.find((a) => a.student.mark === 0)!;
      const strongest = result.find((a) => a.student.mark === 90)!;

      // The strongest and the unmarked student balance each other out, so they
      // land together rather than the unmarked one dragging a class down alone.
      expect(weakest.classObj.id).toBe(strongest.classObj.id);
    });

    it('still places every unmarked student somewhere', () => {
      const cls = classes('A', 'B', 'C');
      const students = cohort(0, 0, 0, 0, 0, 0);

      const result = balancedAverage(students, cls);
      expect(result).toHaveLength(6);
      expect(sizes(result, cls)).toEqual([2, 2, 2]);
    });
  });

  describe('roundRobin', () => {
    it('deals in strict rotation, best first', () => {
      const result = roundRobin(cohort(70, 100, 80, 90, 60, 50), classes('A', 'B', 'C'));

      // Sorted by mark: 100, 90, 80, 70, 60, 50 → A, B, C, A, B, C
      expect(result.map((a) => [a.student.mark, a.classObj.name])).toEqual([
        [100, 'A'], [90, 'B'], [80, 'C'],
        [70, 'A'], [60, 'B'], [50, 'C'],
      ]);
    });
  });

  describe('snakeDraft', () => {
    it('reverses direction on every second pass', () => {
      const result = snakeDraft(evenCohort(6), classes('A', 'B', 'C'));

      expect(result.map((a) => a.classObj.name)).toEqual([
        'A', 'B', 'C',
        'C', 'B', 'A',
      ]);
    });

    it('spreads ability more evenly than round robin', () => {
      const cls = classes('A', 'B', 'C');
      const students = evenCohort(30);

      expect(spread(averages(snakeDraft(students, cls), cls)))
        .toBeLessThan(spread(averages(roundRobin(students, cls), cls)));
    });
  });

  describe('balancedBands', () => {
    it('gives each class one student from each third', () => {
      const cls = classes('A', 'B', 'C');
      const result = balancedBands(evenCohort(9), cls);

      expect(sizes(result, cls)).toEqual([3, 3, 3]);

      // Marks descend 100…92. Each class should hold one of the top three,
      // one of the middle three and one of the bottom three.
      for (const c of cls) {
        const marks = result
          .filter((a) => a.classObj.id === c.id)
          .map((a) => a.student.mark)
          .sort((x, y) => y - x);
        expect(marks[0]).toBeGreaterThanOrEqual(98); // top band
        expect(marks[2]).toBeLessThanOrEqual(94);    // bottom band
      }
    });

    it('fills the emptiest classes when a band is shorter than the class count', () => {
      // The old implementation restarted each band at the first class, so
      // class C was skipped every time and finished empty: 2, 2, 0.
      const cls = classes('A', 'B', 'C');
      const result = balancedBands(evenCohort(4), cls);

      expect(sizes(result, cls)).toEqual([2, 1, 1]);
    });
  });

  describe('applyAlgorithm', () => {
    const students = evenCohort(6);
    const cls = classes('A', 'B', 'C');

    it('dispatches to the requested algorithm', () => {
      expect(applyAlgorithm('round_robin', students, cls)).toEqual(roundRobin(students, cls));
      expect(applyAlgorithm('snake_draft', students, cls)).toEqual(snakeDraft(students, cls));
      expect(applyAlgorithm('balanced_bands', students, cls)).toEqual(balancedBands(students, cls));
      expect(applyAlgorithm('balanced_average', students, cls)).toEqual(balancedAverage(students, cls));
    });

    it('falls back to the balanced average on an unknown name', () => {
      expect(applyAlgorithm('not_a_real_algorithm', students, cls))
        .toEqual(balancedAverage(students, cls));
    });
  });

  describe('summariseBalance', () => {
    it('reports the size and average of each class', () => {
      const cls = classes('A', 'B');
      const students = cohort(100, 80, 60, 40);
      const result = balancedAverage(students, cls);

      const summary = summariseBalance(result, students, cls);

      expect(summary.map((s) => s.size)).toEqual([2, 2]);
      // 100+40 and 80+60 — both average 70.
      expect(summary.map((s) => s.average)).toEqual([70, 70]);
    });

    it('reports a null average for a class with nobody in it', () => {
      const cls = classes('A', 'B');
      const summary = summariseBalance([], [], cls);

      expect(summary.map((s) => s.average)).toEqual([null, null]);
    });
  });
});
