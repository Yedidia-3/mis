export type SchoolBand = 'nursery' | 'lower_primary' | 'upper_primary';

export const SCHOOL_BANDS: { key: SchoolBand; label: string }[] = [
  { key: 'nursery', label: 'Nursery' },
  { key: 'lower_primary', label: 'Lower Primary' },
  { key: 'upper_primary', label: 'Upper Primary' },
];

/**
 * Which section of the school a level belongs to, read from its name:
 * N1–N3 (or KG / Nursery) are nursery, P1–P3 lower primary, P4–P6 upper primary.
 * A level named any other way belongs to no section.
 */
export function bandOf(levelName: string | null | undefined): SchoolBand | null {
  const name = (levelName ?? '').toUpperCase().replace(/\s+/g, '');
  const primary = name.match(/^P(\d)/);
  if (primary) {
    const year = Number(primary[1]);
    if (year >= 1 && year <= 3) return 'lower_primary';
    if (year >= 4 && year <= 6) return 'upper_primary';
    return null;
  }
  if (/^(N\d|NURSERY|KG|BABY|MIDDLE|TOP)/.test(name)) return 'nursery';
  return null;
}
