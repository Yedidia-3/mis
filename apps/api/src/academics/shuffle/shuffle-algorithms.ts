/**
 * Class-assignment algorithms for the shuffle.
 *
 * These are pure functions, deliberately kept free of entities and database
 * access so they can be tested directly — a silent bug here puts a child in
 * the wrong class, and nothing else in the system would notice.
 *
 * ── They work on marks, not ranks ────────────────────────────────────────────
 *
 * Rank is recorded per class on import: each sheet of the spreadsheet is one
 * class, and ranks restart at 1 for every sheet. So "1st in P4A" and "1st in
 * P4C" are the same rank but not the same ability, and ordering a whole
 * P-level by rank silently equates them.
 *
 * A mark is absolute and comparable across classes, so every algorithm here
 * sorts by mark, best first. A student with no mark recorded counts as zero
 * and therefore sorts last — see MarkedStudent.
 */

export interface Assignment<S, C> {
  student: S;
  classObj: C;
}

/**
 * A student paired with the mark the shuffle should judge them on.
 *
 * `mark` is already resolved by the caller: a missing mark is passed as 0, by
 * the school's rule. That means a blank cell in the import is treated as a
 * score of nothing, so callers should make missing marks visible to whoever
 * approves the shuffle rather than letting them pass unremarked.
 */
export interface MarkedStudent<S> {
  student: S;
  mark: number;
}

export type ShuffleAlgorithm =
  | 'balanced_average'
  | 'round_robin'
  | 'snake_draft'
  | 'balanced_bands';

/** Best first. Ties keep their incoming order, so results stay reproducible. */
function byMarkDescending<S>(students: MarkedStudent<S>[]): MarkedStudent<S>[] {
  return students
    .map((s, i) => ({ s, i }))
    .sort((a, b) => b.s.mark - a.s.mark || a.i - b.i)
    .map(({ s }) => s);
}

/**
 * How many students each class should end up with.
 *
 * Class sizes are a physical constraint — a room holds what it holds — so they
 * are balanced first and never traded away for a better spread of marks. With
 * a remainder, the earlier classes take the extra student each.
 */
function capacities(total: number, classCount: number): number[] {
  const base = Math.floor(total / classCount);
  const remainder = total % classCount;
  return Array.from({ length: classCount }, (_, i) => base + (i < remainder ? 1 : 0));
}

/**
 * Equalise the average mark of each class. This is the school's definition of
 * a balanced shuffle.
 *
 * Students are dealt best-first, and each one goes to whichever class has the
 * lowest running total among those still under capacity. Giving the strongest
 * remaining student to the weakest class repeatedly is what pulls the totals
 * together; because the capacities keep class sizes within one of each other,
 * equal totals mean equal averages.
 *
 * This is deterministic — the same input always produces the same classes,
 * which matters when a parent asks why their child was placed where they were.
 */
export function balancedAverage<S, C>(
  students: MarkedStudent<S>[],
  classes: C[],
): Assignment<S, C>[] {
  const ordered = byMarkDescending(students);
  const limits = capacities(ordered.length, classes.length);

  // Each class is aimed at the total it needs to land on the cohort's average.
  // Aiming at *totals* instead would be wrong whenever classes differ in size:
  // 13 students across 3 classes means one class holds 5, and giving it the
  // same total as a class of 4 leaves it a whole grade lower on average.
  const cohortTotal = ordered.reduce((sum, s) => sum + s.mark, 0);
  const cohortMean = ordered.length ? cohortTotal / ordered.length : 0;
  const targets = limits.map((cap) => cap * cohortMean);

  const totals = classes.map(() => 0);
  const counts = classes.map(() => 0);
  const placement: number[] = []; // index into classes, parallel to `ordered`

  for (let s = 0; s < ordered.length; s++) {
    const { mark } = ordered[s];

    // Give the strongest remaining student to whichever class is furthest
    // below the total it needs. Repeating that pulls the averages together.
    let chosen = -1;
    let bestDeficit = -Infinity;
    for (let i = 0; i < classes.length; i++) {
      if (counts[i] >= limits[i]) continue; // full
      const deficit = targets[i] - totals[i];
      if (deficit > bestDeficit) { bestDeficit = deficit; chosen = i; }
    }

    // Capacities always cover the cohort, but never silently drop a child.
    if (chosen === -1) chosen = counts.indexOf(Math.min(...counts));

    totals[chosen] += mark;
    counts[chosen] += 1;
    placement[s] = chosen;
  }

  refineBySwapping(ordered, placement, totals, counts, classes.length);

  return ordered.map(({ student }, s) => ({ student, classObj: classes[placement[s]] }));
}

/** Difference between the highest and lowest class average. */
function averageSpread(totals: number[], counts: number[]): number {
  const averages = totals.map((t, i) => (counts[i] ? t / counts[i] : 0));
  return Math.max(...averages) - Math.min(...averages);
}

/**
 * Fine-tune the greedy result by swapping pairs of students between classes.
 *
 * Dealing best-to-neediest gets close but not exact — it can never revisit a
 * decision. This pass repeatedly takes the first swap that brings the averages
 * closer together and stops when none does.
 *
 * It walks students in a fixed order and takes the first improvement rather
 * than the best one, so the outcome is deterministic: the same cohort always
 * produces the same classes, which matters when a parent asks why their child
 * was placed where they were. The iteration cap only bounds pathological
 * cases; normal cohorts settle long before it.
 */
function refineBySwapping<S>(
  ordered: MarkedStudent<S>[],
  placement: number[],
  totals: number[],
  counts: number[],
  classCount: number,
): void {
  if (classCount < 2) return;

  const maxPasses = 40;
  for (let pass = 0; pass < maxPasses; pass++) {
    let improved = false;

    for (let a = 0; a < ordered.length && !improved; a++) {
      for (let b = a + 1; b < ordered.length; b++) {
        const ca = placement[a];
        const cb = placement[b];
        if (ca === cb) continue;

        const markA = ordered[a].mark;
        const markB = ordered[b].mark;
        if (markA === markB) continue; // swapping equals changes nothing

        const before = averageSpread(totals, counts);

        // Swapping keeps class sizes identical, so capacity stays satisfied.
        totals[ca] += markB - markA;
        totals[cb] += markA - markB;

        if (averageSpread(totals, counts) < before - 1e-9) {
          placement[a] = cb;
          placement[b] = ca;
          improved = true;
          break;
        }

        totals[ca] -= markB - markA; // revert
        totals[cb] -= markA - markB;
      }
    }

    if (!improved) return;
  }
}

/**
 * Deal students to classes in rotation, best first: A, B, C, A, B, C…
 *
 * Class sizes stay within one of each other, but because the input is sorted
 * by mark, class A collects every 1st, 4th and 7th best student — a mild but
 * consistent advantage.
 */
export function roundRobin<S, C>(
  students: MarkedStudent<S>[],
  classes: C[],
): Assignment<S, C>[] {
  return byMarkDescending(students).map(({ student }, i) => ({
    student,
    classObj: classes[i % classes.length],
  }));
}

/**
 * Deal in a snaking order: A, B, C, then C, B, A, then A, B, C…
 *
 * Reversing every other pass cancels out the skew plain round-robin leaves
 * behind, so the classes end up much closer in average mark.
 */
export function snakeDraft<S, C>(
  students: MarkedStudent<S>[],
  classes: C[],
): Assignment<S, C>[] {
  return byMarkDescending(students).map(({ student }, i) => {
    const round = Math.floor(i / classes.length);
    const pos = i % classes.length;
    const idx = round % 2 === 0 ? pos : classes.length - 1 - pos;
    return { student, classObj: classes[idx] };
  });
}

/**
 * Split the mark order into three equal bands — top, middle, bottom third —
 * and share each band across the classes, so every class gets a comparable
 * mix of abilities.
 *
 * Each band is dealt starting with the classes holding the fewest students so
 * far. That matters when a band is shorter than the class count: the previous
 * implementation restarted at the first class for every band, so with a small
 * cohort the trailing classes were skipped repeatedly and could end up empty
 * (4 students across 3 classes gave 2, 2, 0). Dealing to the emptiest classes
 * first makes that impossible.
 */
export function balancedBands<S, C>(
  students: MarkedStudent<S>[],
  classes: C[],
): Assignment<S, C>[] {
  const ordered = byMarkDescending(students);
  const bandSize = Math.ceil(ordered.length / 3);

  const bands = [
    ordered.slice(0, bandSize),
    ordered.slice(bandSize, bandSize * 2),
    ordered.slice(bandSize * 2),
  ];

  const counts = classes.map(() => 0);
  const result: Assignment<S, C>[] = [];

  for (const band of bands) {
    // Emptiest first, ties by original order — so a short band tops up the
    // classes that need students rather than always favouring the first.
    const order = classes
      .map((_, i) => i)
      .sort((a, b) => counts[a] - counts[b] || a - b);

    band.forEach(({ student }, i) => {
      const classIndex = order[i % order.length];
      counts[classIndex] += 1;
      result.push({ student, classObj: classes[classIndex] });
    });
  }

  return result;
}

/**
 * Dispatch to the requested algorithm, falling back to the balanced average —
 * the school's default — for an unrecognised name, so a bad value degrades
 * into the best behaviour rather than throwing mid-shuffle.
 *
 * Callers must handle the empty-classes case before calling this.
 */
export function applyAlgorithm<S, C>(
  algorithm: string,
  students: MarkedStudent<S>[],
  classes: C[],
): Assignment<S, C>[] {
  switch (algorithm) {
    case 'round_robin':
      return roundRobin(students, classes);
    case 'snake_draft':
      return snakeDraft(students, classes);
    case 'balanced_bands':
      return balancedBands(students, classes);
    case 'balanced_average':
    default:
      return balancedAverage(students, classes);
  }
}

export interface ClassBalance {
  size: number;
  total: number;
  average: number | null;
}

/**
 * What the shuffle actually produced, per class, in the order the classes were
 * given. The principal approving a shuffle should be able to see the resulting
 * averages rather than take the word "balanced" on trust.
 */
export function summariseBalance<S, C>(
  assignments: Assignment<S, C>[],
  students: MarkedStudent<S>[],
  classes: C[],
): ClassBalance[] {
  const markOf = new Map<S, number>(students.map((s) => [s.student, s.mark]));

  return classes.map((cls) => {
    const mine = assignments.filter((a) => a.classObj === cls);
    const total = mine.reduce((sum, a) => sum + (markOf.get(a.student) ?? 0), 0);
    return {
      size: mine.length,
      total: Math.round(total * 100) / 100,
      average: mine.length ? Math.round((total / mine.length) * 100) / 100 : null,
    };
  });
}
