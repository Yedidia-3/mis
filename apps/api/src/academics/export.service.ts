import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, WidthType, AlignmentType, BorderStyle, HeadingLevel,
} from 'docx';

export interface ClassExportData {
  className: string;
  pLevelName: string;
  students: { name: string; rank?: number | null; marks_percentage?: number | null; former_class?: string | null }[];
}

@Injectable()
export class ExportService {

  async generateXlsx(classes: ClassExportData[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Jericho School';
    workbook.created = new Date();

    for (const cls of classes) {
      const label = `${cls.pLevelName}${cls.className}`;
      const sheet = workbook.addWorksheet(label.substring(0, 31));

      sheet.columns = [
        { header: 'No.', key: 'no', width: 6 },
        { header: 'Student Name', key: 'name', width: 35 },
        { header: 'Former Class', key: 'former_class', width: 14 },
        { header: 'Rank', key: 'rank', width: 8 },
        { header: 'Marks %', key: 'marks', width: 10 },
      ];

      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF001F5B' } };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

      cls.students.forEach((s, i) => {
        sheet.addRow({
          no: i + 1,
          name: s.name,
          former_class: s.former_class ?? '',
          rank: s.rank ?? '',
          marks: s.marks_percentage != null ? s.marks_percentage : '',
        });
      });

      sheet.addRow([]);
      sheet.addRow([`Total: ${cls.students.length} students`]);
    }

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async generateDocx(classes: ClassExportData[]): Promise<Buffer> {
    const sections = classes.map((cls) => {
      const label = `${cls.pLevelName} ${cls.className}`;

      const headerCells = ['No.', 'Student Name', 'Former Class', 'Rank', 'Marks %'].map(
        (text) => new TableCell({
          width: { size: text === 'Student Name' ? 40 : 15, type: WidthType.PERCENTAGE },
          shading: { color: 'auto', fill: '001F5B' },
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text, bold: true, color: 'FFFFFF', size: 20 })],
          })],
        }),
      );

      const dataRows = cls.students.map((s, i) => {
        const values = [
          String(i + 1),
          s.name,
          s.former_class ?? '',
          s.rank != null ? String(s.rank) : '',
          s.marks_percentage != null ? `${s.marks_percentage}%` : '',
        ];
        return new TableRow({
          children: values.map((text, ci) => new TableCell({
            width: { size: ci === 1 ? 40 : 15, type: WidthType.PERCENTAGE },
            children: [new Paragraph({
              alignment: ci === 1 ? AlignmentType.LEFT : AlignmentType.CENTER,
              children: [new TextRun({ text, size: 20 })],
            })],
          })),
        });
      });

      // Attendance-form rows: empty status columns for manual marking
      const attendanceCells = ['No.', 'Student Name', 'Present', 'Absent', 'Late'].map(
        (text) => new TableCell({
          width: { size: text === 'Student Name' ? 40 : 15, type: WidthType.PERCENTAGE },
          shading: { color: 'auto', fill: '001F5B' },
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text, bold: true, color: 'FFFFFF', size: 20 })],
          })],
        }),
      );

      const attendanceRows = cls.students.map((s, i) => {
        const values = [String(i + 1), s.name, '', '', ''];
        return new TableRow({
          children: values.map((text, ci) => new TableCell({
            width: { size: ci === 1 ? 40 : 15, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
              left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
              right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
            },
            children: [new Paragraph({
              alignment: ci === 1 ? AlignmentType.LEFT : AlignmentType.CENTER,
              spacing: { before: 40, after: 40 },
              children: [new TextRun({ text, size: 20 })],
            })],
          })),
        });
      });

      return {
        properties: {},
        children: [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: `JERICHO SCHOOL`, bold: true, size: 28 })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [new TextRun({ text: `Class List — ${label}`, size: 24 })],
          }),
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { after: 100 },
            children: [new TextRun({ text: `Total Students: ${cls.students.length}`, size: 20, italics: true })],
          }),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [new TableRow({ children: headerCells }), ...dataRows],
          }),

          // Attendance form section
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            alignment: AlignmentType.CENTER,
            spacing: { before: 600, after: 200 },
            children: [new TextRun({ text: `Attendance List — ${label}`, bold: true, size: 24 })],
          }),
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { after: 100 },
            children: [
              new TextRun({ text: 'Date: ____________    ', size: 20 }),
              new TextRun({ text: 'Teacher: ____________', size: 20 }),
            ],
          }),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [new TableRow({ children: attendanceCells }), ...attendanceRows],
          }),

          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { before: 300 },
            children: [
              new TextRun({ text: `Present: ____   Absent: ____   Late: ____   Total: ${cls.students.length}`, size: 18, italics: true }),
            ],
          }),
        ],
      };
    });

    const doc = new Document({ sections });
    const buffer = await Packer.toBuffer(doc);
    return Buffer.from(buffer);
  }

  async generateTimetableXlsx(plan: TimetableExportData): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Jericho School';
    workbook.created = new Date();
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    for (const section of plan.sections) {
      const label = `${section.pLevel} ${section.section}`.substring(0, 31);
      const sheet = workbook.addWorksheet(label);

      sheet.columns = [
        { header: 'Period', key: 'period', width: 12 },
        ...dayNames.map((d) => ({ header: d, key: d.toLowerCase(), width: 20 })),
      ];

      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF001F5B' } };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

      for (const period of section.periods) {
        const row: Record<string, string> = { period: period.isBreak ? period.label : `P${period.index + 1} (${period.time})` };
        if (period.isBreak) {
          dayNames.forEach((d) => { row[d.toLowerCase()] = period.label; });
        } else {
          for (let day = 0; day < 5; day++) {
            const slot = period.days[day];
            row[dayNames[day].toLowerCase()] = slot ? `${slot.courseCode}${slot.teacherName ? ' - ' + slot.teacherName : ''}` : '';
          }
        }
        const addedRow = sheet.addRow(row);
        if (period.isBreak) {
          addedRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F4F6' } };
          addedRow.font = { italic: true, color: { argb: 'FF9A9A9A' } };
        }
      }
    }

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async generateTimetableDocx(plan: TimetableExportData): Promise<Buffer> {
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    const sections = plan.sections.map((section) => {
      const label = `${section.pLevel} — Section ${section.section}`;

      const headerCells = ['Period', ...dayNames].map(
        (text) => new TableCell({
          width: { size: text === 'Period' ? 15 : 17, type: WidthType.PERCENTAGE },
          shading: { color: 'auto', fill: '001F5B' },
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text, bold: true, color: 'FFFFFF', size: 18 })],
          })],
        }),
      );

      const dataRows = section.periods.map((period) => {
        const periodLabel = period.isBreak ? period.label : `P${period.index + 1}\n${period.time}`;
        const cells = [periodLabel];

        if (period.isBreak) {
          return new TableRow({
            children: [
              new TableCell({
                width: { size: 15, type: WidthType.PERCENTAGE },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: periodLabel, size: 18, italics: true })] })],
              }),
              ...dayNames.map(() => new TableCell({
                width: { size: 17, type: WidthType.PERCENTAGE },
                shading: { color: 'auto', fill: 'F4F4F6' },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: period.label, size: 18, italics: true, color: '9A9A9A' })] })],
              })),
            ],
          });
        }

        return new TableRow({
          children: [
            new TableCell({
              width: { size: 15, type: WidthType.PERCENTAGE },
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: periodLabel, size: 18 })] })],
            }),
            ...dayNames.map((_, dayIdx) => {
              const slot = period.days[dayIdx];
              const lines: TextRun[] = [];
              if (slot) {
                lines.push(new TextRun({ text: slot.courseCode, bold: true, size: 18 }));
                if (slot.teacherName) lines.push(new TextRun({ text: `\n${slot.teacherName}`, size: 16, color: '666666', break: 1 }));
              }
              return new TableCell({
                width: { size: 17, type: WidthType.PERCENTAGE },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: lines.length ? lines : [new TextRun({ text: '', size: 18 })] })],
              });
            }),
          ],
        });
      });

      return {
        properties: {},
        children: [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'JERICHO SCHOOL', bold: true, size: 28 })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
            children: [new TextRun({ text: `Timetable — ${plan.name}`, size: 24 })],
          }),
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [new TextRun({ text: label, size: 22 })],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [new TableRow({ children: headerCells }), ...dataRows],
          }),
        ],
      };
    });

    const doc = new Document({ sections });
    const buffer = await Packer.toBuffer(doc);
    return Buffer.from(buffer);
  }
}

export interface TimetableExportData {
  name: string;
  sections: {
    pLevel: string;
    section: string;
    periods: {
      index: number;
      time: string;
      isBreak: boolean;
      label: string;
      days: ({ courseCode: string; teacherName: string | null } | null)[];
    }[];
  }[];
}
