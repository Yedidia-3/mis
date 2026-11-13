import { BadRequestException } from '@nestjs/common';
import type * as XLSXType from 'xlsx';

function loadXlsx(): typeof XLSXType {
  try {
    // Required only while reading a workbook. A missing install must not stop the API from booting.
    return require('xlsx') as typeof XLSXType;
  } catch {
    throw new BadRequestException('Excel import is unavailable until the spreadsheet package is installed on the server.');
  }
}

export interface ParsedClassRow {
  name: string;
  cells: Record<string, string>;
  rank?: number;
  marks?: number | null;
  formerClass?: string;
  studentIdNumber?: string;
}

export interface ParsedClassSheet {
  headers: string[];
  rows: ParsedClassRow[];
  classLabel: string | null;
}

const NAME_HEADER = /^(names?|noms?( et pr[eé]noms?)?|student name|full name|fullname)$/i;
const RANK_HEADER = /^(rank|position|place|class position)$/i;
const MARKS_HEADER = /^(marks|marks %|marks%|percentage|average|moyenne|total %)$/i;
const FORMER_HEADER = /^(former class|former_class|previous class|ancienne classe)$/i;
const ID_HEADER = /^(student id|student_id|student code|id|reg no|registration number|matricule|code)$/i;
const SUB_HEADER = /^(cat|exam|tot|tj|total)$/i;

function text(value: unknown): string {
  if (value == null || value === '') return '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number.isInteger(value) ? String(value) : String(value);
  }
  return String(value).replace(/\s+/g, ' ').trim();
}

/** P1-A, P1C and P 4 D all become level P4 and letter D. */
export function classCodeFromLabel(label: string): { level: string; letter: string } | null {
  const compact = label.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const match = compact.match(/^([A-Z]+\d+)([A-Z])$/);
  if (!match) return null;
  return { level: match[1], letter: match[2] };
}

function isNameHeader(value: string): boolean {
  return NAME_HEADER.test(value);
}

/** Read the first worksheet that contains a name column. */
export function parseClassListSheet(buffer: Buffer): ParsedClassSheet {
  const XLSX = loadXlsx();
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  if (!workbook.SheetNames.length) {
    throw new BadRequestException('No sheets found in the uploaded file');
  }

  let parsed: ParsedClassSheet | null = null;
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true }) as unknown[][];
    const attempt = parseGrid(grid);
    if (attempt) {
      parsed = attempt;
      break;
    }
  }

  if (!parsed || !parsed.rows.length) {
    throw new BadRequestException('Could not find a name column and student rows in this file.');
  }
  return parsed;
}

function parseGrid(grid: unknown[][]): ParsedClassSheet | null {
  const limit = Math.min(grid.length, 25);
  let headerIndex = -1;
  for (let r = 0; r < limit; r++) {
    const row = (grid[r] ?? []).map(text);
    if (row.some(isNameHeader)) {
      headerIndex = r;
      break;
    }
  }
  if (headerIndex === -1) return null;

  const headerRow = (grid[headerIndex] ?? []).map(text);
  const next = (grid[headerIndex + 1] ?? []).map(text);
  const subCount = next.filter((cell) => SUB_HEADER.test(cell)).length;
  const useSub = subCount >= 3;
  const lastCol = Math.max(headerRow.length, useSub ? next.length : 0);

  const headers: string[] = [];
  const indexes: number[] = [];
  let carry = '';
  for (let c = 0; c < lastCol; c++) {
    const top = headerRow[c] ?? '';
    if (top) carry = top;
    const sub = useSub ? (next[c] ?? '') : '';
    let label = '';
    if (useSub && SUB_HEADER.test(sub)) label = carry ? `${carry} ${sub}` : sub;
    else if (top) label = top;
    else if (!useSub) label = top;
    label = label.replace(/\s+/g, ' ').trim();
    if (!label) continue;
    if (headers.includes(label)) label = `${label} (${c + 1})`;
    headers.push(label);
    indexes.push(c);
  }

  const namePos = headers.findIndex((h) => isNameHeader(h));
  if (namePos === -1) return null;

  const start = headerIndex + (useSub ? 2 : 1);
  const rows: ParsedClassRow[] = [];
  const seen = new Set<string>();

  for (let r = start; r < grid.length; r++) {
    const source = grid[r] ?? [];
    const cells: Record<string, string> = {};
    indexes.forEach((col, i) => {
      const value = text(source[col]);
      if (value) cells[headers[i]] = value;
    });
    const name = cells[headers[namePos]] ?? '';
    if (!name || isNameHeader(name)) continue;
    if (/^(total|moyenne|average|grand total)$/i.test(name)) continue;
    const key = normalizeName(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const rankHeader = headers.find((h) => RANK_HEADER.test(h));
    const marksHeader = headers.find((h) => MARKS_HEADER.test(h));
    const formerHeader = headers.find((h) => FORMER_HEADER.test(h));
    const idHeader = headers.find((h) => ID_HEADER.test(h) && !isNameHeader(h));
    const rankRaw = rankHeader ? Number(cells[rankHeader]) : undefined;
    const marksRaw = marksHeader ? Number(String(cells[marksHeader]).replace('%', '')) : undefined;

    rows.push({
      name,
      cells,
      rank: rankRaw != null && Number.isFinite(rankRaw) ? rankRaw : undefined,
      marks: marksRaw != null && Number.isFinite(marksRaw) ? marksRaw : null,
      formerClass: formerHeader ? cells[formerHeader] : undefined,
      studentIdNumber: idHeader ? cells[idHeader] : undefined,
    });
  }

  let classLabel: string | null = null;
  for (let r = 0; r < Math.min(grid.length, 20); r++) {
    const label = text((grid[r] ?? [])[0]).replace(/:$/, '');
    const value = text((grid[r] ?? [])[1]);
    if (/^class$/i.test(label) && value) {
      classLabel = value;
      break;
    }
  }

  return { headers, rows, classLabel };
}

export function normalizeName(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function sheetCell(student: { name: string; former_class?: string | null; rank?: number | null; marks_percentage?: number | string | null; sheet?: Record<string, string> | null }, header: string): string {
  const stored = student.sheet?.[header];
  if (stored != null && stored !== '') return stored;
  if (isNameHeader(header)) return student.name ?? '';
  if (FORMER_HEADER.test(header)) return student.former_class ?? '';
  if (RANK_HEADER.test(header)) return student.rank != null ? String(student.rank) : '';
  if (MARKS_HEADER.test(header)) return student.marks_percentage != null && student.marks_percentage !== '' ? String(student.marks_percentage) : '';
  return '';
}
