import {
  canonicalSubject, kigaliToday, midtermCopy, midtermLines, nurseryClassTitle, primaryYear, rankTotals, sumLines,
} from './bulletin';

describe('mid-term bulletin', () => {
  it('reads the level year from a P-level name', () => {
    expect(primaryYear('P1')).toBe(1);
    expect(primaryYear('P 4')).toBe(4);
    expect(primaryYear('P6')).toBe(6);
    expect(primaryYear('N3')).toBeNull();
    expect(primaryYear('Top')).toBeNull();
  });

  it('uses the workbook maxima', () => {
    const p1 = midtermCopy(1);
    expect(p1.layout).toBe('french');
    expect(p1.subjects.map((s) => [s.name, s.max])).toEqual([
      ['MATHEMATIQUES', 60],
      ['ETUDES SOCIALES', 30],
      ['KINYARWANDA', 80],
      ['ENGLISH', 80],
      ['STE', 30],
      ['FRANÇAIS', 80],
    ]);
    expect(midtermCopy(2).subjects.find((s) => s.code === 'SRS')?.max).toBe(50);
    expect(midtermCopy(3).layout).toBe('english');
    expect(midtermCopy(3).subjects.find((s) => s.code === 'FRANCAIS')?.max).toBe(60);
    expect(midtermCopy(3).level_value).toBe('LOWER');
    expect(midtermCopy(5).subjects.find((s) => s.code === 'FRANCAIS')?.max).toBe(40);
    expect(midtermCopy(5).level_value).toBe('UPPER');
  });

  it('recognises the bulletin subjects by code or name', () => {
    expect(canonicalSubject('STE', 'Science and Elementary Technology')).toBe('SET');
    expect(canonicalSubject('SRS', 'Social Studies')).toBe('SRS');
    expect(canonicalSubject('FR', 'Français')).toBe('FRANCAIS');
    expect(canonicalSubject('CREATIVE', 'Creative Arts')).toBeNull();
  });

  it('sums points out of the maxima and flags a blank as zero', () => {
    const subjects = midtermCopy(1).subjects.map((s, i) => ({ id: i + 1, ...s }));
    const lines = midtermLines(subjects, (id) => (id === 1 ? 48 : null));
    expect(lines[0].points).toEqual({ value: 48, max: 60, flags: [] });
    expect(lines[1].points.value).toBe(0);
    expect(lines[1].points.flags[0].code).toBe('missing_mark');
    expect(sumLines(lines)).toEqual({ total: 48, max: 360, percentage: 13.33 });
  });

  it('ranks equal totals on the same place', () => {
    const ranks = rankTotals([{ id: 1, total: 80 }, { id: 2, total: 90 }, { id: 3, total: 90 }]);
    expect([ranks.get(2), ranks.get(3), ranks.get(1)]).toEqual([1, 1, 3]);
  });
});

describe('nursery bulletin', () => {
  it('prints the maternelle class the way the sheet does', () => {
    expect(nurseryClassTitle('N3', 'B')).toBe('3ème maternelle B');
    expect(nurseryClassTitle('Top', 'A')).toBe('3ème maternelle A');
    expect(nurseryClassTitle('Baby', 'A')).toBe('1ère maternelle A');
    expect(nurseryClassTitle('Middle', 'C')).toBe('2ème maternelle C');
    expect(nurseryClassTitle('N3', '3ème maternelle B')).toBe('3ème maternelle B');
  });

  it('dates the bulletin on the Kigali calendar', () => {
    expect(kigaliToday(new Date('2026-07-02T22:30:00Z'))).toBe('2026-07-03');
    expect(kigaliToday(new Date('2026-07-02T10:00:00Z'))).toBe('2026-07-02');
  });
});
