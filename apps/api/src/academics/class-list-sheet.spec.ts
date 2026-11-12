import * as XLSX from 'xlsx';
import { parseClassListSheet } from './class-list-sheet';

function workbook(rows: unknown[][], bookType: 'xlsx' | 'xls' = 'xlsx'): Buffer {
  const book = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(book, sheet, 'Class');
  return XLSX.write(book, { type: 'buffer', bookType }) as Buffer;
}

describe('parseClassListSheet', () => {
  it('reads a simple class list and keeps its columns', () => {
    const parsed = parseClassListSheet(workbook([
      ['Name', 'Rank', 'Marks', 'Former Class'],
      ['Alice Mukamana', 1, 98, 'NUR-A'],
      ['Alice Mukamana', 1, 98, 'NUR-A'],
      ['Béatrice Nshimiyimana', 2, 97, 'NUR-B'],
    ]));
    expect(parsed.headers).toEqual(['Name', 'Rank', 'Marks', 'Former Class']);
    expect(parsed.rows.map((r) => r.name)).toEqual(['Alice Mukamana', 'Béatrice Nshimiyimana']);
    expect(parsed.rows[0].rank).toBe(1);
    expect(parsed.rows[0].formerClass).toBe('NUR-A');
    expect(parsed.rows[0].marks).toBe(98);
  });

  it('reads a summary sheet with repeated CAT EXAM TOT columns', () => {
    const parsed = parseClassListSheet(workbook([
      ['', '', '', ''],
      ['NO', 'NAMES', 'MATHEMATIQUES', '', '', 'Average', 'Class Position'],
      ['', '', 'CAT', 'EXAM', 'TOT', '', 32],
      [1, 'AKARIZA Erica Ailla', 12, 12, 24, 16],
      ['', '', '', '', '', ''],
    ], 'xls'));
    expect(parsed.headers).toEqual([
      'NO', 'NAMES', 'MATHEMATIQUES CAT', 'MATHEMATIQUES EXAM', 'MATHEMATIQUES TOT', 'Average', 'Class Position',
    ]);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].name).toBe('AKARIZA Erica Ailla');
    expect(parsed.rows[0].cells['MATHEMATIQUES TOT']).toBe('24');
    expect(parsed.rows[0].marks).toBe(16);
  });
});
