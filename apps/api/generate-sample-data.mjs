/**
 * Generates sample Excel import files for the Jericho School Management System.
 * Each file: 3 sheets (A, B, C), 25 students per sheet.
 * Columns: Name | Rank | Marks | Former Class
 * Run: node generate-sample-data.mjs  (from the api/ directory)
 */
import ExcelJS from 'exceljs';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dir, '..', 'sample-data');
mkdirSync(OUT_DIR, { recursive: true });

// ── Colour palette ─────────────────────────────────────────────────────────
const NAVY  = '001F5B';
const GRAY  = 'F4F4F6';
const WHITE = 'FFFFFF';
const GOLD  = 'C9A84C';

// ── Name pools (Rwandan given names × Kinyarwanda surnames) ───────────────
const GIVEN = [
  'Alice','Béatrice','Carol','Diane','Emma','Françoise','Grace','Honorine',
  'Inès','Joséphine','Keza','Laure','Marie','Nadine','Olive','Patricia',
  'Quirine','Rachel','Sophie','Thérèse','Ursula','Valérie','Wendy','Yvonne','Zoe',
  'Bob','Christian','Denis','Etienne','Frank','Gabriel','Hervé','Ivan',
  'Jean','Kevin','Laurent','Mathieu','Nicolas','Olivier','Patrick','Quentin',
  'Remy','Samuel','Thierry','Urbain','Victor','William','Xavier','Yves','Cédric',
  'Aline','Benjamin','Christine','David','Elise','Ferdinand','Gisèle','Henry',
  'Isabelle','Jacqueline','Léon','Madeleine','Nathan','Odette','Philippe',
  'Robert','Solange','Thomas','Ange','Claudine','Vestine','Clarisse','Paul',
];

const SURNAMES = [
  'Mukamana','Nshimiyimana','Uwase','Habimana','Iradukunda','Mugisha',
  'Uwamahoro','Tuyishime','Mukamurenzi','Niyonsaba','Ingabire','Mutoni',
  'Nizigama','Umuhoza','Kayitesi','Mukandekezi','Umutoni','Ndagijimana',
  'Uwineza','Mukazayire','Umurerwa','Bayisenge','Nkurunziza','Hakizimana',
  'Maniraguha','Bizimana','Munyaneza','Nzeyimana','Rukundo','Nzabonimana',
  'Irakoze','Gahima','Uwimana','Ndayisaba','Bimenyimana','Nkusi',
  'Sebahizi','Rurangwa','Musabyimana','Munyandamutsa','Nsanzimana','Kanyamibwa',
  'Uwingabire','Twagirimana','Niyomugabo','Mugiraneza','Nzabonihana','Gasasira',
  'Mugemana','Kabalisa',
];

// Generate a deterministic unique name given an index
function name(idx) {
  return `${GIVEN[idx % GIVEN.length]} ${SURNAMES[(idx + Math.floor(idx / GIVEN.length)) % SURNAMES.length]}`;
}

// ── Styling helpers ────────────────────────────────────────────────────────
function headerStyle(cell) {
  cell.font = { bold: true, color: { argb: `FF${WHITE}` }, name: 'Arial', size: 11 };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${NAVY}` } };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  cell.border = {
    bottom: { style: 'thin', color: { argb: `FF${GOLD}` } },
  };
}

function dataStyle(cell, isAltRow) {
  cell.font = { name: 'Arial', size: 10 };
  if (isAltRow) {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${GRAY}` } };
  }
  cell.alignment = { vertical: 'middle' };
}

// ── Core builder ──────────────────────────────────────────────────────────
async function buildFile({ filename, former }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Jericho School';
  wb.created = new Date();

  // 3 classes per p-level: A, B, C
  // Marks bands: sheet A slightly higher range, C slightly lower
  const bands = [
    { start: 98, end: 62 },   // Sheet A
    { start: 96, end: 56 },   // Sheet B
    { start: 94, end: 51 },   // Sheet C
  ];

  ['A', 'B', 'C'].forEach((sheetName, si) => {
    const ws = wb.addWorksheet(sheetName, {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    // Column definitions
    ws.columns = [
      { header: 'Name',         key: 'name',   width: 30 },
      { header: 'Rank',         key: 'rank',   width: 8  },
      { header: 'Marks',        key: 'marks',  width: 10 },
      { header: 'Former Class', key: 'former', width: 16 },
    ];

    // Style header row
    ws.getRow(1).height = 22;
    ws.getRow(1).eachCell(cell => headerStyle(cell));

    // 25 students per sheet
    const { start, end } = bands[si];
    const step = (start - end) / 24;          // marks decrease per rank

    for (let rank = 1; rank <= 25; rank++) {
      const marks = Math.round(start - (rank - 1) * step);
      const formerClass = former[(rank - 1) % 3];  // rotate through 3 former classes
      const nameIdx = si * 25 + rank - 1;          // unique across all 3 sheets
      const isAlt = rank % 2 === 0;

      const row = ws.addRow({
        name:   name(nameIdx),
        rank:   rank,
        marks:  marks,
        former: formerClass,
      });

      row.height = 18;
      row.eachCell(cell => dataStyle(cell, isAlt));

      // Right-align numbers
      row.getCell('rank').alignment  = { horizontal: 'center', vertical: 'middle' };
      row.getCell('marks').alignment = { horizontal: 'center', vertical: 'middle' };
    }
  });

  const outPath = join(OUT_DIR, filename);
  await wb.xlsx.writeFile(outPath);
  console.log(`✓  ${filename}  →  ${outPath}`);
}

// ── Generate all 4 files ──────────────────────────────────────────────────
console.log('\nGenerating sample Excel import files...\n');

await buildFile({
  filename: 'P1-Import.xlsx',
  former:   ['NUR-A', 'NUR-B', 'NUR-C'],
});

await buildFile({
  filename: 'P2-Import.xlsx',
  former:   ['P1A', 'P1B', 'P1C'],
});

await buildFile({
  filename: 'P5-Import.xlsx',
  former:   ['P4A', 'P4B', 'P4C'],
});

await buildFile({
  filename: 'P6-Import.xlsx',
  former:   ['P5A', 'P5B', 'P5C'],
});

console.log('\nDone! Files saved to: sample-data/\n');
console.log('Each file has 3 sheets (A, B, C) × 25 students = 75 students per P-Level.');
console.log('Import via: Dean → Import Data → select P-Level → upload file.\n');
