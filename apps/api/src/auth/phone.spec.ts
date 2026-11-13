import { canonicalPhone, phoneLookupKeys } from './phone';

describe('phone', () => {
  it('treats local, 250, and +250 as the same Rwanda number', () => {
    expect(canonicalPhone('0788 123 456')).toBe('0788123456');
    expect(canonicalPhone('+250788123456')).toBe('0788123456');
    expect(canonicalPhone('250788123456')).toBe('0788123456');
    expect(phoneLookupKeys('0788123456').sort()).toEqual(['+250788123456', '0788123456', '250788123456'].sort());
    expect(canonicalPhone('788123456')).toBe('0788123456');
  });

  it('rejects a value that is too short', () => {
    expect(canonicalPhone('12345')).toBeNull();
    expect(phoneLookupKeys('abc')).toEqual([]);
  });
});
