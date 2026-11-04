/** Navigation bands for Courses and Academic Records. Not a shared curriculum. */
export type SchoolBand = "nursery" | "lower_primary" | "upper_primary";

export const SCHOOL_BANDS: { key: SchoolBand; label: string; path: string; hint: string }[] = [
  { key: "nursery", label: "Nursery", path: "nursery", hint: "N1–N3 and nursery classes" },
  { key: "lower_primary", label: "Lower Primary", path: "lower-primary", hint: "P1–P3" },
  { key: "upper_primary", label: "Upper Primary", path: "upper-primary", hint: "P4–P6" },
];

export const BAND_FROM_PATH: Record<string, SchoolBand> = {
  nursery: "nursery",
  "lower-primary": "lower_primary",
  "upper-primary": "upper_primary",
};

export const BAND_PATH: Record<SchoolBand, string> = {
  nursery: "nursery",
  lower_primary: "lower-primary",
  upper_primary: "upper-primary",
};

/** Same rules as the API school-band helper. */
export function bandOf(levelName: string | null | undefined): SchoolBand | null {
  if (!levelName) return null;
  const name = levelName.replace(/\s+/g, "").toUpperCase();
  const primary = name.match(/^P([1-6])$/);
  if (primary) {
    const year = Number(primary[1]);
    if (year >= 1 && year <= 3) return "lower_primary";
    if (year >= 4 && year <= 6) return "upper_primary";
  }
  if (/^(N\d|NURSERY|KG|BABY|MIDDLE|TOP)/.test(name)) return "nursery";
  return null;
}
