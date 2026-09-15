import { ValueTransformer } from 'typeorm';

/**
 * Postgres `numeric` arrives from the driver as a string, because it holds more
 * precision than a JS number can. Left alone that makes `a + b` concatenate
 * ("80" + "20" = "8020") — silently wrong, and exactly the sort of bug that
 * would corrupt a grade without throwing.
 *
 * Marks and weights are small, bounded values, so a JS number represents them
 * exactly. This converts at the boundary so the rest of the code can do
 * arithmetic normally.
 */
export const numericTransformer: ValueTransformer = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};
