/**
 * Input rules for marks and reports. These mirror the API's
 * academics/assessments/dto/input-rules.ts so a teacher sees a problem as they
 * type; the API enforces the same rules again on every request.
 */
export const RULES = {
  TITLE_MIN: 2,
  TITLE_MAX: 120,
  TITLE_PATTERN: /^[\p{L}\p{N}][\p{L}\p{N} .,'’()\-–/&:#]*$/u,
  GROUP_MAX: 40,
  GROUP_PATTERN: /^\p{L}[\p{L} .'’\-&]*$/u,
  TERM_NAME_MIN: 2,
  TERM_NAME_MAX: 40,
  DATE_PATTERN: /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/,
  MAX_SCORE_MIN: 1,
  MAX_SCORE_MAX: 1000,
  REPORT_MAX_MIN: 1,
  REPORT_MAX_MAX: 500,
  DECIMALS: 2,
} as const;

/** Characters a mark may contain while it is being typed. */
const NUMBER_TYPING = /^\d{0,4}([.,]\d{0,2})?$/;
const NUMBER_FINAL = /^\d{1,4}(\.\d{1,2})?$/;

export const CATEGORIES = [
  { value: "quiz", label: "Quiz" },
  { value: "homework", label: "Homework" },
  { value: "exam", label: "Exam" },
] as const;
export type Category = (typeof CATEGORIES)[number]["value"];
export const categoryLabel = (c: string | null | undefined) =>
  CATEGORIES.find((x) => x.value === c)?.label ?? "Uncategorised";

export function normaliseText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Drops control characters as text is typed or pasted, and caps the length. */
export function sanitiseTyping(value: string, max: number): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u001F\u007F]/g, "").slice(0, max);
}

/** Keeps only what can become a valid mark: digits and one decimal point, two places. */
export function sanitiseNumberTyping(value: string): string | null {
  const v = value.replace(/\s/g, "");
  if (v === "") return "";
  if (!NUMBER_TYPING.test(v)) return null;
  return v.replace(",", ".");
}

export function validateTitle(raw: string): string | null {
  const v = normaliseText(raw);
  if (v.length < RULES.TITLE_MIN) return `Title must be at least ${RULES.TITLE_MIN} characters`;
  if (v.length > RULES.TITLE_MAX) return `Title must be at most ${RULES.TITLE_MAX} characters`;
  if (!RULES.TITLE_PATTERN.test(v)) {
    return "Use letters, numbers, spaces and . , ' ( ) - / & : # only, starting with a letter or number";
  }
  return null;
}

export function validateTermName(raw: string): string | null {
  const v = normaliseText(raw);
  if (v.length < RULES.TERM_NAME_MIN || v.length > RULES.TERM_NAME_MAX) {
    return `Name must be ${RULES.TERM_NAME_MIN}–${RULES.TERM_NAME_MAX} characters`;
  }
  if (!RULES.TITLE_PATTERN.test(v)) return "Use letters, numbers, spaces and simple punctuation only";
  return null;
}

export function validateGroup(raw: string): string | null {
  const v = normaliseText(raw);
  if (v === "") return null;
  if (v.length > RULES.GROUP_MAX) return `At most ${RULES.GROUP_MAX} characters`;
  if (!RULES.GROUP_PATTERN.test(v)) return "Letters, spaces and . ' - & only, starting with a letter";
  return null;
}

export function isRealDate(value: string): boolean {
  if (!RULES.DATE_PATTERN.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function todayIso(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function validateAssessmentDate(
  value: string,
  term?: { name: string; start_date: string; end_date: string } | null,
): string | null {
  if (!isRealDate(value)) return "Enter a real date";
  if (term && (value < term.start_date || value > term.end_date)) {
    return `Must fall inside ${term.name} (${term.start_date} to ${term.end_date})`;
  }
  if (value > todayIso()) return "The date cannot be in the future";
  return null;
}

/** Validates a numeric field and returns the parsed number when valid. */
export function parseBoundedNumber(
  raw: string,
  min: number,
  max: number,
  label: string,
): { value: number | null; error: string | null } {
  const v = raw.trim().replace(",", ".");
  if (v === "") return { value: null, error: `${label} is required` };
  if (!NUMBER_FINAL.test(v)) return { value: null, error: `${label} must be a number with at most 2 decimals` };
  const n = Number(v);
  if (!Number.isFinite(n)) return { value: null, error: `${label} must be a number` };
  if (n < min) return { value: null, error: `${label} must be at least ${min}` };
  if (n > max) return { value: null, error: `${label} must be at most ${max}` };
  return { value: n, error: null };
}

/** A mark: blank is allowed while drafting, otherwise 0…max with two decimals. */
export function validateScore(raw: string, max: number): { value: number | null; error: string | null } {
  if (raw.trim() === "") return { value: null, error: null };
  return parseBoundedNumber(raw, 0, max, "Mark");
}
