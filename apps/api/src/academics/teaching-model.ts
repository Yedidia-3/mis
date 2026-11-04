/**
 * How a new P-level should organise teaching, from its name.
 *
 * Nursery and P1–P2 keep one class teacher for every subject.
 * P3–P6 use subject specialists — e.g. P3A can have separate teachers for
 * English, Maths, and Kinyarwanda & French.
 *
 * Names are matched loosely (P3, p3, "P 3") so spelling does not decide the
 * model by accident. Anything else defaults to class_teacher; the dean can
 * change it on the P-level afterwards.
 */
export type TeachingModel = 'class_teacher' | 'specialist';

export function defaultTeachingModel(levelName: string): TeachingModel {
  const compact = levelName.replace(/\s+/g, '').toUpperCase();
  const primary = compact.match(/^P([1-6])$/);
  if (primary) {
    const year = Number(primary[1]);
    return year >= 3 ? 'specialist' : 'class_teacher';
  }
  return 'class_teacher';
}
