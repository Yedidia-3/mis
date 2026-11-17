/**
 * The two bulletins this school prints from the MIS.
 *
 * Mid-term (P1–P6) follows the class workbooks: one total per subject, out of
 * a maximum that is fixed for the level. Nursery follows the maternelle
 * sheet: a colour for each activity in each term, a short observation, and
 * one deliberation for the year.
 *
 * Nothing here is configured by the dean. The numbers and the rows are the
 * ones on those sheets.
 */

export type BulletinCode = 'MATH' | 'SRS' | 'KINY' | 'ENGLISH' | 'SET' | 'FRANCAIS';

export const BULLETIN_ORDER: BulletinCode[] = ['MATH', 'SRS', 'KINY', 'ENGLISH', 'SET', 'FRANCAIS'];

/** Points each subject is out of, taken from the mid-term workbooks. P6 uses the P4–P5 sheet. */
export const MIDTERM_MAXIMA: Record<number, Record<BulletinCode, number>> = {
  1: { MATH: 60, SRS: 30, KINY: 80, ENGLISH: 80, SET: 30, FRANCAIS: 80 },
  2: { MATH: 60, SRS: 50, KINY: 60, ENGLISH: 70, SET: 30, FRANCAIS: 70 },
  3: { MATH: 100, SRS: 100, KINY: 100, ENGLISH: 100, SET: 100, FRANCAIS: 60 },
  4: { MATH: 100, SRS: 100, KINY: 100, ENGLISH: 100, SET: 100, FRANCAIS: 40 },
  5: { MATH: 100, SRS: 100, KINY: 100, ENGLISH: 100, SET: 100, FRANCAIS: 40 },
  6: { MATH: 100, SRS: 100, KINY: 100, ENGLISH: 100, SET: 100, FRANCAIS: 40 },
};

const FRENCH_NAMES: Record<BulletinCode, string> = {
  MATH: 'MATHEMATIQUES',
  SRS: 'ETUDES SOCIALES',
  KINY: 'KINYARWANDA',
  ENGLISH: 'ENGLISH',
  SET: 'STE',
  FRANCAIS: 'FRANÇAIS',
};

const ENGLISH_NAMES: Record<BulletinCode, string> = {
  MATH: 'MATHEMATICS',
  SRS: 'SRS',
  KINY: 'KINYARWANDA',
  ENGLISH: 'ENGLISH',
  SET: 'SET',
  FRANCAIS: 'FRENCH',
};

/** Names used when a level is missing one of the six bulletin subjects. */
export const SUBJECT_RECORD_NAMES: Record<BulletinCode, { name: string; code: string }> = {
  MATH: { name: 'Mathematics', code: 'MATH' },
  SRS: { name: 'Social Studies', code: 'SRS' },
  KINY: { name: 'Kinyarwanda', code: 'KINY' },
  ENGLISH: { name: 'English', code: 'ENGLISH' },
  SET: { name: 'SET', code: 'SET' },
  FRANCAIS: { name: 'Français', code: 'FRANCAIS' },
};

export type NurseryRating = 'excellent' | 'tres_bon' | 'bon' | 'assez_bon';
export const NURSERY_RATINGS: NurseryRating[] = ['excellent', 'tres_bon', 'bon', 'assez_bon'];
export const NURSERY_RATING_LABELS: Record<NurseryRating, string> = {
  excellent: 'EXCELLENT',
  tres_bon: 'TRES BON',
  bon: 'BON',
  assez_bon: 'ASSEZ BON',
};

export type NurseryDecision = 'promu' | 'redoublement' | 'renvoye';
export const NURSERY_DECISIONS: { value: NurseryDecision; label: string }[] = [
  { value: 'promu', label: "L'ELEVE EST PROMU" },
  { value: 'redoublement', label: "L'ELEVE EST ADMIS AU REDOUBLEMENT" },
  { value: 'renvoye', label: "L'ELEVE EST RENVOYE" },
];

export interface NurserySubject { code: string; name: string }
export interface NurseryArea { code: string; title: string; subjects: NurserySubject[] }

/** Rows of the maternelle bulletin, in the order they are printed. */
export const NURSERY_AREAS: NurseryArea[] = [
  {
    code: 'A',
    title: 'A. CONNAISSANCES GENERALES',
    subjects: [
      { code: 'pre_calcul', name: 'PRE-CALCUL' },
      { code: 'pre_lecture', name: 'PRE-LECTURE' },
      { code: 'pre_ecriture', name: 'PRE-ECRITURE' },
    ],
  },
  {
    code: 'B',
    title: 'B. EXPRESSION',
    subjects: [
      { code: 'langage', name: 'LANGAGE' },
      { code: 'dessin', name: 'DESSIN' },
      { code: 'recitation', name: 'RECITATION' },
      { code: 'chant', name: 'CHANT' },
    ],
  },
  {
    code: 'C',
    title: 'C. ACTIVITES MANUELLES',
    subjects: [
      { code: 'peinture', name: 'PEINTURE' },
      { code: 'decoupage', name: 'DECOUPAGE' },
      { code: 'modelage', name: 'MODELAGE' },
      { code: 'coloriage', name: 'COLORIAGE' },
    ],
  },
  {
    code: 'D',
    title: 'D. SPORT',
    subjects: [
      { code: 'dirige', name: 'DIRIGE' },
      { code: 'libre', name: 'LIBRE' },
    ],
  },
];

export const NURSERY_SUBJECTS: NurserySubject[] = NURSERY_AREAS.flatMap((a) => a.subjects);
export const NURSERY_CODES = NURSERY_SUBJECTS.map((s) => s.code);

const fold = (value: string) =>
  value.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]/g, '');

/** P1–P6 from a level name. Anything else is not a mid-term level. */
export function primaryYear(levelName: string | null | undefined): number | null {
  const name = fold(levelName ?? '');
  const match = name.match(/^P([1-6])$/);
  return match ? Number(match[1]) : null;
}

/**
 * Which of the six bulletin subjects a course is, whether it was stored as
 * MATH, STE, Français, or Social Studies.
 */
export function canonicalSubject(code: string, name: string): BulletinCode | null {
  const c = fold(code);
  const n = fold(name);
  if (c === 'MATH' || c === 'MATHS' || n.startsWith('MATH')) return 'MATH';
  if (c === 'SRS' || c === 'SS' || n.includes('SOCIAL') || n.includes('ETUDESSOCIAL')) return 'SRS';
  if (c === 'KINY' || c === 'KINYARWANDA' || n.includes('KINYARWANDA')) return 'KINY';
  if (c === 'ENGLISH' || c === 'ENG' || n === 'ENGLISH') return 'ENGLISH';
  if (c === 'SET' || c === 'STE' || n === 'SET' || n === 'STE' || n.includes('ELEMENTARYTECH')) return 'SET';
  if (c === 'FRANCAIS' || c === 'FRENCH' || c === 'FR' || n.includes('FRANC') || n === 'FRENCH') return 'FRANCAIS';
  return null;
}

export interface MidtermCopy {
  layout: 'french' | 'english';
  country: string;
  ministry: string;
  city: string;
  district: string;
  sector: string;
  school: string;
  phone: string;
  email: string;
  year_label: string;
  class_label: string;
  level_label: string;
  level_value: string;
  title: string;
  name_label: string;
  course_label: string;
  period_label: string;
  max_label: string;
  points_label: string;
  total_label: string;
  percentage_label: string;
  place_label: string;
  parent_sign: string;
  teacher_sign: string;
  done_at: string;
  date_label: string;
  subjects: { code: BulletinCode; name: string; max: number }[];
}

/** Printed words for one primary level. P1–P2 stay in French; P3–P6 use the English sheet. */
export function midtermCopy(year: number): MidtermCopy {
  const maxima = MIDTERM_MAXIMA[year];
  const french = year <= 2;
  const names = french ? FRENCH_NAMES : ENGLISH_NAMES;
  const subjects = BULLETIN_ORDER.map((code) => ({ code, name: names[code], max: maxima[code] }));
  if (french) {
    return {
      layout: 'french',
      country: 'REPUBLIQUE DU RWANDA',
      ministry: "MINISTERE DE L'EDUCATION",
      city: 'VILLE DE KIGALI',
      district: 'DISTRICT DE NYARUGENGE',
      sector: 'SECTEUR NYAMIRAMBO',
      school: 'JERICHO SCHOOL',
      phone: '0788695562',
      email: 'jericho.school@yahoo.fr',
      year_label: 'A/S:',
      class_label: 'CLASSE:',
      level_label: 'NIVEAU:',
      level_value: 'INFERIEUR',
      title: 'BULLETIN SCOLAIRE',
      name_label: 'NOMS:',
      course_label: 'COURS',
      period_label: 'MI-TRIMESTRE',
      max_label: 'MAX',
      points_label: 'POINTS',
      total_label: 'TOTAL',
      percentage_label: 'POURCENTAGE',
      place_label: 'PLACE',
      parent_sign: 'SIGNATURE DES PARENTS',
      teacher_sign: 'SIGNATURE DU TITULAIRE',
      done_at: 'FAIT A JERICHO SCHOOL',
      date_label: 'DATE',
      subjects,
    };
  }
  return {
    layout: 'english',
    country: 'REPUBLIC OF RWANDA',
    ministry: 'MINISTRY OF EDUCATION',
    city: 'KIGALI CITY',
    district: 'NYARUGENGE DISTRICT',
    sector: 'NYAMIRAMBO SECTOR',
    school: 'JERICHO SCHOOL',
    phone: '0788695562',
    email: 'jericho.school@yahoo.com',
    year_label: 'SCHOOL YEAR:',
    class_label: 'CLASS:',
    level_label: 'LEVEL:',
    level_value: year === 3 ? 'LOWER' : 'UPPER',
    title: 'SCHOOL REPORT',
    name_label: 'Names:',
    course_label: 'SUBJECTS',
    period_label: 'MID-TERM',
    max_label: 'MAX',
    points_label: 'MARKS',
    total_label: 'TOTAL',
    percentage_label: 'PERCENTAGE',
    place_label: 'POSITION',
    parent_sign: "PARENT'S SIGNATURE",
    teacher_sign: "CLASS TEACHER'S SIGNATURE",
    done_at: 'Done at JERICHO SCHOOL',
    date_label: 'on',
    subjects,
  };
}

/** "3ème maternelle B" from a level such as N3, Top, or KG3 and a class letter. */
export function nurseryClassTitle(levelName: string, className: string): string {
  const letter = className.trim();
  if (/maternelle/i.test(letter)) return letter;
  const compact = fold(levelName);
  const ordinal = (digit: string) => (digit === '1' ? '1ère' : `${digit}ème`);
  let year = '';
  if (/^(N1|NURSERY1|BABY|KG1|1ERE)/.test(compact)) year = '1ère';
  else if (/^(N2|MIDDLE|KG2|2EME)/.test(compact)) year = '2ème';
  else if (/^(N3|TOP|KG3|3EME)/.test(compact)) year = '3ème';
  else {
    const digit = compact.match(/[123]/);
    if (digit) year = ordinal(digit[0]);
  }
  if (!year) return `${levelName} ${letter}`.trim();
  return `${year} maternelle ${letter}`.trim();
}

export interface MarkCell {
  value: number;
  max: number;
  flags: { code: string; message: string }[];
}

export interface MidtermLine {
  subject_id: number;
  code: BulletinCode;
  name: string;
  max: number;
  points: MarkCell;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * One pupil's mid-term line. A blank is zero, as the workbook's SUM treats an
 * empty cell, and it is flagged so the dean sees it before printing.
 */
export function midtermLines(
  subjects: { id: number; code: BulletinCode; name: string; max: number }[],
  scoreOf: (subjectId: number) => number | null,
): MidtermLine[] {
  return subjects.map((subject) => {
    const raw = scoreOf(subject.id);
    const flags = raw === null
      ? [{ code: 'missing_mark', message: `No mark for ${subject.name}` }]
      : [];
    const value = raw === null ? 0 : Math.min(raw, subject.max);
    return {
      subject_id: subject.id,
      code: subject.code,
      name: subject.name,
      max: subject.max,
      points: { value: round2(value), max: subject.max, flags },
    };
  });
}

export function sumLines(lines: MidtermLine[]): { total: number; max: number; percentage: number | null } {
  const total = round2(lines.reduce((n, l) => n + l.points.value, 0));
  const max = round2(lines.reduce((n, l) => n + l.points.max, 0));
  const percentage = max > 0 ? round2(Math.min(100, (total / max) * 100)) : null;
  return { total, max, percentage };
}

/** Competition rank, best first. Equal totals share a place and the next place is skipped. */
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

/** Today's calendar date in Kigali, as YYYY-MM-DD. */
export function kigaliToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Kigali',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
