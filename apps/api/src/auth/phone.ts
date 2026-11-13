/** Canonical local form for Rwanda numbers (0788123456). Other numbers stay as digits. */
export function canonicalPhone(raw: string): string | null {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.startsWith('250') && digits.length === 12) return `0${digits.slice(3)}`;
  if (digits.startsWith('0') && digits.length === 10) return digits;
  // A 9-digit number starting with 7 is a Rwanda mobile missing the leading 0.
  if (digits.startsWith('7') && digits.length === 9) return `0${digits}`;
  if (digits.length >= 9 && digits.length <= 15) return digits;
  return null;
}

/** Every stored or typed shape that should match the same phone. */
export function phoneLookupKeys(raw: string): string[] {
  const canonical = canonicalPhone(raw);
  if (!canonical) return [];
  const keys = new Set<string>([canonical]);
  if (canonical.startsWith('0') && canonical.length === 10) {
    const intl = `250${canonical.slice(1)}`;
    keys.add(intl);
    keys.add(`+${intl}`);
  }
  return [...keys];
}
