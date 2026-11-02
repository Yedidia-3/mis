import { Transform } from 'class-transformer';

/**
 * Limits on everything a teacher or the dean types into the academic records.
 *
 * The frontend mirrors these in src/lib/academicRules.ts. The API enforces
 * them regardless, and the database repeats the numeric ceilings as CHECKs.
 */
export const RULES = {
  TITLE_MIN: 2,
  TITLE_MAX: 120,
  // Letters (any script, so accents in French names are fine), digits, spaces
  // and the punctuation a title realistically needs. Must start with a letter
  // or digit. Angle brackets, quotes, backslashes and control characters are
  // refused so nothing typed here can break the printed report.
  TITLE_PATTERN: /^[\p{L}\p{N}][\p{L}\p{N} .,'’()\-–/&:#]*$/u,
  GROUP_MAX: 40,
  GROUP_PATTERN: /^\p{L}[\p{L} .'’\-&]*$/u,
  DATE_PATTERN: /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/,
  MAX_SCORE_MIN: 1,
  MAX_SCORE_MAX: 1000,
  SCORE_MIN: 0,
  SCORE_MAX: 1000,
  REPORT_MAX_MIN: 1,
  REPORT_MAX_MAX: 500,
  DECIMALS: 2,
  ROSTER_MAX: 300,
  ID_MAX: 2147483647,
} as const;

export const NUMBER_OPTS = { allowNaN: false, allowInfinity: false, maxDecimalPlaces: RULES.DECIMALS };

/** Trims and collapses runs of whitespace; leaves non-strings for the validators to reject. */
export const NormaliseText = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : value));

/** True when the string is a real calendar date (rejects 2026-02-30). */
export function isRealDate(value: string): boolean {
  if (!RULES.DATE_PATTERN.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}
