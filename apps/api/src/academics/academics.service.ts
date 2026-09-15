import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as ExcelJS from 'exceljs';
import { Repository } from 'typeorm';
import { AcademicYear } from '../entities/academic-year.entity';
import { AttendanceSession } from '../entities/attendance-session.entity';
import { Attendance } from '../entities/attendance.entity';
import { Class } from '../entities/class.entity';
import { PLevel } from '../entities/p-level.entity';
import { Student } from '../entities/student.entity';
import { UploadedTimetable } from '../entities/uploaded-timetable.entity';
import { User } from '../entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { TeachingService } from './teaching/teaching.service';

@Injectable()
export class AcademicsService {
  constructor(
    @InjectRepository(PLevel) private pLevelRepo: Repository<PLevel>,
    @InjectRepository(Class) private classRepo: Repository<Class>,
    @InjectRepository(Student) private studentRepo: Repository<Student>,
    @InjectRepository(AcademicYear) private yearRepo: Repository<AcademicYear>,
    @InjectRepository(Attendance) private attendanceRepo: Repository<Attendance>,
    @InjectRepository(AttendanceSession) private attendanceSessionRepo: Repository<AttendanceSession>,
    private notificationsService: NotificationsService,
    private teachingService: TeachingService,
    @InjectRepository(UploadedTimetable) private uploadedTimetableRepo: Repository<UploadedTimetable>,
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {}

  // ─── P-Levels ────────────────────────────────────────────────────────────────

  async listAcademicYears() {
    return this.yearRepo.find({ order: { created_at: 'DESC' } });
  }

  async getPLevel(id: number) {
    const pl = await this.pLevelRepo.findOne({ where: { id } });
    if (!pl) throw new NotFoundException('P-Level not found');
    return pl;
  }

  async listPLevels(academicYearId: number) {
    // Raw SQL — TypeORM relation loading is unreliable here and doesn't carry
    // student counts. Return each P-Level with its active classes, the per-class
    // student count, and distribution status so the Dean's P-Levels module and
    // dashboard reflect distributed classes accurately.
    const plevels = await this.pLevelRepo.query(
      `SELECT id, name, academic_year_id, status
       FROM p_levels
       WHERE academic_year_id = $1 AND status = 'active'
       ORDER BY name ASC`,
      [academicYearId],
    );
    if (!plevels.length) return [];

    const plIds = plevels.map((p: any) => p.id);
    const classes = await this.classRepo.query(
      `SELECT c.id, c.name, c.p_level_id, c.teacher_id, c.distributed_at,
              (SELECT COUNT(*) FROM students s WHERE s.current_class_id = c.id) AS student_count
       FROM classes c
       WHERE c.p_level_id = ANY($1) AND c.status = 'active'
       ORDER BY c.name ASC`,
      [plIds],
    );

    const byPl = new Map<number, any[]>();
    for (const c of classes) {
      if (!byPl.has(c.p_level_id)) byPl.set(c.p_level_id, []);
      byPl.get(c.p_level_id)!.push({
        id: c.id,
        name: c.name,
        teacher_id: c.teacher_id,
        distributed_at: c.distributed_at,
        student_count: Number(c.student_count ?? 0),
      });
    }

    return plevels.map((p: any) => {
      const cls = byPl.get(p.id) ?? [];
      return {
        ...p,
        classes: cls,
        class_count: cls.length,
        student_count: cls.reduce((s: number, c: any) => s + c.student_count, 0),
        is_distributed: cls.length > 0 && cls.every((c: any) => c.distributed_at),
        any_distributed: cls.some((c: any) => c.distributed_at),
      };
    });
  }

  async createPLevel(name: string, academicYearId: number) {
    const cleanName = name.trim();
    const year = await this.yearRepo.findOne({ where: { id: academicYearId } });
    if (!year) throw new NotFoundException('Academic year not found');
    const existing = await this.pLevelRepo.findOne({
      where: { name: cleanName, academic_year_id: academicYearId, status: 'active' },
    });
    if (existing) {
      throw new BadRequestException(`A P-Level named "${cleanName}" already exists in this academic year.`);
    }
    const pl = this.pLevelRepo.create({ name: cleanName, academic_year_id: academicYearId, status: 'active' });
    return this.pLevelRepo.save(pl);
  }

  async deletePLevel(id: number) {
    const pl = await this.pLevelRepo.findOne({ where: { id } });
    if (!pl) throw new NotFoundException('P-Level not found');
    pl.status = 'inactive';
    await this.pLevelRepo.save(pl);
    await this.classRepo.update({ p_level_id: id }, { status: 'inactive' });
    return { message: 'P-Level deactivated' };
  }

  // ─── Classes ─────────────────────────────────────────────────────────────────

  async listClasses(pLevelId: number) {
    // Raw SQL — reliable student counts + teacher name + distribution status.
    const rows = await this.classRepo.query(
      `SELECT c.id, c.name, c.p_level_id, c.teacher_id, c.status, c.distributed_at,
              t.name AS teacher_name,
              (SELECT COUNT(*) FROM students s WHERE s.current_class_id = c.id) AS student_count
       FROM classes c
       LEFT JOIN users t ON t.id = c.teacher_id
       WHERE c.p_level_id = $1 AND c.status = 'active'
       ORDER BY c.name ASC`,
      [pLevelId],
    );
    return rows.map((c: any) => ({
      id: c.id,
      name: c.name,
      p_level_id: c.p_level_id,
      teacher_id: c.teacher_id,
      status: c.status,
      distributed_at: c.distributed_at,
      teacher: c.teacher_id ? { id: c.teacher_id, name: c.teacher_name } : null,
      student_count: Number(c.student_count ?? 0),
    }));
  }

  async createClass(name: string, pLevelId: number) {
    const cleanName = name.trim().toUpperCase();
    const pl = await this.pLevelRepo.findOne({ where: { id: pLevelId, status: 'active' } });
    if (!pl) throw new NotFoundException('P-Level not found');
    const existing = await this.classRepo.findOne({
      where: { name: cleanName, p_level_id: pLevelId, status: 'active' },
    });
    if (existing) {
      throw new BadRequestException(`Class "${cleanName}" already exists in ${pl.name}.`);
    }
    const cls = this.classRepo.create({ name: cleanName, p_level_id: pLevelId, status: 'active' });
    return this.classRepo.save(cls);
  }

  async deleteClass(id: number) {
    const cls = await this.classRepo.findOne({ where: { id }, relations: ['students'] });
    if (!cls) throw new NotFoundException('Class not found');
    const activeStudents = cls.students?.filter((s) => s.status !== 'transferred' && (s as any).status !== 'inactive') ?? [];
    if (activeStudents.length) throw new BadRequestException('Cannot delete class with active students. Reassign students first.');
    cls.status = 'inactive';
    await this.classRepo.save(cls);
    return { message: 'Class deactivated' };
  }

  async assignTeacher(classId: number, teacherId: number) {
    const cls = await this.classRepo.findOne({ where: { id: classId } });
    if (!cls) throw new NotFoundException('Class not found');
    cls.teacher_id = teacherId;
    const saved = await this.classRepo.save(cls);

    // At a level where one teacher takes every subject, assigning them to the
    // class already says what they teach. Filling that in here is what spares
    // the dean a form asking for something the system just learned.
    await this.teachingService.syncClassTeacherAssignments(classId);

    return saved;
  }

  // ─── Students ────────────────────────────────────────────────────────────────

  async getStudentsByClass(classId: number) {
    return this.studentRepo.find({
      where: { current_class_id: classId },
      order: { rank: 'ASC' },
    });
  }

  async addStudentsToClass(
    classId: number,
    students: Array<{ name?: string; former_class?: string; rank?: number | string; marks_percentage?: number | string }>,
  ) {
    const cls = await this.classRepo.findOne({ where: { id: classId } });
    if (!cls) throw new NotFoundException('Class not found');

    const normalized = (students ?? [])
      .map((s) => {
        const name = String(s?.name ?? '').trim();
        if (!name) return null;

        const formerClass = s?.former_class === undefined || s?.former_class === null || s?.former_class === ''
          ? null
          : String(s.former_class).trim() || null;

        const rankValue = s?.rank === undefined || s?.rank === null || s?.rank === ''
          ? null
          : Number(s.rank);

        const marksValue = s?.marks_percentage === undefined || s?.marks_percentage === null || s?.marks_percentage === ''
          ? null
          : this.parseMarks(s.marks_percentage);

        return {
          name,
          former_class: formerClass,
          rank: Number.isFinite(rankValue) ? rankValue : null,
          marks_percentage: marksValue,
        };
      })
      .filter(Boolean);

    if (!normalized.length) {
      throw new BadRequestException('Provide at least one student name');
    }

    const deduped = normalized.filter((entry, idx, arr) => arr.findIndex((item) => item.name.toLowerCase() === entry.name.toLowerCase()) === idx);

    const pLevel = await this.pLevelRepo.findOne({ where: { id: cls.p_level_id } });
    if (!pLevel) throw new NotFoundException('P-Level not found');

    const studentRows = deduped.map((entry) => this.studentRepo.create({
      name: entry.name,
      academic_year_id: pLevel.academic_year_id,
      current_class_id: classId,
      former_class: entry.former_class,
      rank: entry.rank,
      marks_percentage: entry.marks_percentage,
      status: 'active',
    }));

    const saved = await this.studentRepo.save(studentRows);
    return {
      created: saved.length,
      students: saved.map((s) => ({ id: s.id, name: s.name, current_class_id: s.current_class_id })),
    };
  }

  async updateStudent(
    studentId: number,
    updates: { name?: string; former_class?: string | null; rank?: number | string | null; marks_percentage?: number | string | null },
  ) {
    const student = await this.studentRepo.findOne({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Student not found');

    if (updates.name !== undefined) {
      const name = String(updates.name ?? '').trim();
      if (!name) throw new BadRequestException('Student name is required');
      student.name = name;
    }

    if (updates.former_class !== undefined) {
      const formerClass = updates.former_class === null || updates.former_class === ''
        ? null
        : String(updates.former_class).trim() || null;
      student.former_class = formerClass;
    }

    if (updates.rank !== undefined) {
      const rankValue = updates.rank === null || updates.rank === '' ? null : Number(updates.rank);
      if (rankValue !== null && (!Number.isFinite(rankValue) || rankValue < 0)) {
        throw new BadRequestException('Rank must be a non-negative number');
      }
      student.rank = rankValue;
    }

    if (updates.marks_percentage !== undefined) {
      student.marks_percentage = updates.marks_percentage === null || updates.marks_percentage === ''
        ? null
        : this.parseMarks(updates.marks_percentage);
    }

    return this.studentRepo.save(student);
  }

  async getStudentCountForPLevel(pLevelId: number, academicYearId: number) {
    const classes = await this.classRepo.find({
      where: { p_level_id: pLevelId, status: 'active' },
    });
    if (!classes.length) return { count: 0 };
    const classIds = classes.map((c) => c.id);
    const count = await this.studentRepo
      .createQueryBuilder('s')
      .where('s.current_class_id IN (:...ids)', { ids: classIds })
      .andWhere('s.academic_year_id = :yid', { yid: academicYearId })
      .getCount();
    return { count };
  }

  async moveStudent(studentId: number, newClassId: number) {
    const student = await this.studentRepo.findOne({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Student not found');
    student.current_class_id = newClassId;
    return this.studentRepo.save(student);
  }

  // ─── Excel Import ─────────────────────────────────────────────────────────────
  private parseMarks(raw: any): number | null {
    if (raw === null || raw === undefined) return null;
    const s = String(raw).trim();
    if (s === '') return null;

    // Normalize decimal comma and remove spaces
    const normalized = s.replace(/,/g, '.').replace(/\s+/g, '');

    // Detect percent sign
    const hasPercent = normalized.includes('%');
    const numericStr = normalized.replace('%', '');
    const n = Number(numericStr);
    if (!isFinite(n) || isNaN(n)) return null;

    // If user supplied a fraction like 0.85 assume it's 85%
    if (!hasPercent && n > 0 && n <= 1) {
      return Math.round(n * 10000) / 100; // two decimals
    }

    // Otherwise treat provided number as percentage (e.g. 85 or 85.5)
    return Math.round(n * 100) / 100;
  }


  async importExcel(pLevelId: number, academicYearId: number, buffer: Buffer) {
    const pl = await this.pLevelRepo.findOne({ where: { id: pLevelId } });
    if (!pl) throw new NotFoundException('P-Level not found');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const errors: string[] = [];
    const allStudents: Partial<Student>[] = [];

    for (const sheet of workbook.worksheets) {
      const sheetName = sheet.name.toUpperCase().trim(); // A, B, C

      // Find or create class matching sheet name
      let cls = await this.classRepo.findOne({ where: { p_level_id: pLevelId, name: sheetName } });
      if (!cls) {
        cls = this.classRepo.create({ name: sheetName, p_level_id: pLevelId });
        cls = await this.classRepo.save(cls);
      }

      const seenRanks = new Map<number, number>(); // rank -> row number
      const seenNames = new Map<string, number>();

      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // skip header

        const name = String(row.getCell(1).value ?? '').trim();
        const rank = Number(row.getCell(2).value);
        const marks = this.parseMarks(row.getCell(3).value);
        const formerClass = String(row.getCell(4).value ?? '').trim();

        if (!name) return; // skip blank rows

        if (!rank) {
          errors.push(`Sheet ${sheetName} row ${rowNumber}: Missing rank`);
          return;
        }

        if (seenRanks.has(rank)) {
          // Tie — allowed, warn only
        }
        seenRanks.set(rank, rowNumber);

        if (seenNames.has(name.toLowerCase())) {
          errors.push(`Sheet ${sheetName} row ${rowNumber}: Duplicate student name "${name}" (warning)`);
        }
        seenNames.set(name.toLowerCase(), rowNumber);

        allStudents.push({
          name,
          rank,
          marks_percentage: marks === null ? null : marks,
          former_class: formerClass || null,
          current_class_id: cls.id,
          academic_year_id: academicYearId,
          status: 'active',
        });
      });
    }

    if (errors.filter((e) => !e.includes('warning')).length > 0) {
      throw new BadRequestException({ message: 'Import validation failed', errors });
    }

    // Clear existing students for this p-level in this year
    const existingClasses = await this.classRepo.find({ where: { p_level_id: pLevelId } });
    const classIds = existingClasses.map((c) => c.id);
    if (classIds.length) {
      await this.studentRepo
        .createQueryBuilder()
        .delete()
        .where('current_class_id IN (:...ids)', { ids: classIds })
        .andWhere('academic_year_id = :yid', { yid: academicYearId })
        .execute();
    }

    await this.studentRepo.save(allStudents.map((s) => this.studentRepo.create(s)));

    return {
      message: `Imported ${allStudents.length} students across ${workbook.worksheets.length} class(es)`,
      warnings: errors.filter((e) => e.includes('warning')),
    };
  }

  // -------------------- Timetable upload + views -------------------------
  async uploadTimetable(academicYearId: number, buffer: Buffer, uploadedBy: number) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const parsedSheets: any[] = [];

    for (const sheet of workbook.worksheets) {
      // Build a flexible header map from first row
      const rows = [] as any[];
      const headerRow = sheet.getRow(1);
      const headers: string[] = [];
      headerRow.eachCell((cell, colNumber) => {
        headers[colNumber] = String(cell.value ?? '').trim().toLowerCase();
      });

      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // skip header
        const obj: any = {};
        row.eachCell((cell, colNumber) => {
          const key = headers[colNumber] ?? `col${colNumber}`;
          obj[key] = cell.value;
        });
        // ignore empty rows
        if (Object.values(obj).every((v) => v === null || v === undefined || String(v).trim() === '')) return;
        rows.push(obj);
      });

      parsedSheets.push({ name: sheet.name, rows });
    }

    // Build teacher mapping by attempting to match sheet-level teacher columns or
    // scanning sheet contents for known teacher names. This produces a
    // `teacher_map` keyed by sheet name with { detectedName, userId } so the
    // teacher-specific view can be authoritative.
    const teachers = await this.userRepo.find({ where: { role: 'teacher', status: 'active' } });
    const teacherMap: Record<string, { detectedName: string | null; userId: number | null }> = {};

    for (const s of parsedSheets) {
      const rows = s.rows || [];
      let detectedName: string | null = null;
      // Prefer explicit teacher column if present
      const teacherValues: string[] = [];
      for (const r of rows) {
        if (r.teacher) teacherValues.push(String(r.teacher).trim());
        else if (r.teacher_name) teacherValues.push(String(r.teacher_name).trim());
      }
      if (teacherValues.length > 0) {
        // pick the most common non-empty value
        const freq = new Map<string, number>();
        for (const v of teacherValues) {
          if (!v) continue;
          const key = v.toLowerCase();
          freq.set(key, (freq.get(key) || 0) + 1);
        }
        if (freq.size > 0) {
          const top = Array.from(freq.entries()).sort((a, b) => b[1] - a[1])[0][0];
          detectedName = teacherValues.find((t) => t.toLowerCase() === top) ?? null;
        }
      }

      // Fallback: scan for teacher full-name substrings in sheet cells
      if (!detectedName) {
        for (const t of teachers) {
          const tn = t.name.toLowerCase();
          const found = rows.some((r: any) => Object.values(r).some((c: any) => typeof c === 'string' && c.toLowerCase().includes(tn)));
          if (found) { detectedName = t.name; break; }
        }
      }

      const matched = detectedName ? teachers.find((u) => u.name.toLowerCase() === detectedName!.toLowerCase()) : null;
      teacherMap[s.name] = { detectedName: detectedName ?? null, userId: matched ? matched.id : null };
    }

    const entity = this.uploadedTimetableRepo.create({
      name: `Upload ${new Date().toISOString()}`,
      academic_year_id: academicYearId,
      uploaded_by: uploadedBy,
      data: { sheets: parsedSheets, teacher_map: teacherMap },
    });
    const saved = await this.uploadedTimetableRepo.save(entity);
    return { id: saved.id, message: `Uploaded ${parsedSheets.length} sheet(s)` };
  }

  async listUploadedTimetables(academicYearId: number) {
    const rows = await this.uploadedTimetableRepo.find({ where: { academic_year_id: academicYearId }, order: { created_at: 'DESC' } });
    return rows.map((r) => ({ id: r.id, name: r.name, created_at: r.created_at }));
  }

  async getUploadedTimetable(id: number) {
    const rec = await this.uploadedTimetableRepo.findOne({ where: { id } });
    if (!rec) throw new NotFoundException('Uploaded timetable not found');
    // Return the stored data as the payload so the frontend receives { sheets, teacher_map }
    // along with the upload id for context.
    return { id: rec.id, ...(rec.data ?? {}) };
  }

  async getTeacherTimetable(teacherId: number) {
    // Use the stored teacher_map (if available) to determine which sheets
    // belong to the requested teacher. Also include any global sheets.
    const rec = await this.uploadedTimetableRepo.findOne({ order: { created_at: 'DESC' } });
    if (!rec) return { sheets: [] };
    const sheets = rec.data?.sheets ?? [];
    const teacherMap = rec.data?.teacher_map ?? {};

    const isGlobal = (name: string) => /global|all|master/i.test(name);

    const result = sheets
      .filter((s: any) => {
        const mapping = teacherMap?.[s.name];
        if (mapping && mapping.userId) return mapping.userId === teacherId;
        if (isGlobal(s.name)) return true;
        // Fallback: include sheet if any cell contains the teacher's id as string
        return s.rows.some((r: any) => Object.values(r).some((v: any) => String(v ?? '').toLowerCase().includes(String(teacherId))));
      })
      .map((s: any) => ({ name: s.name, rows: s.rows }));

    return { id: rec.id, sheets: result };
  }

  async exportUploadedTimetable(id: number) {
    const rec = await this.uploadedTimetableRepo.findOne({ where: { id } });
    if (!rec) throw new NotFoundException('Uploaded timetable not found');
    const wb = new ExcelJS.Workbook();
    for (const s of rec.data.sheets || []) {
      const ws = wb.addWorksheet(s.name.substring(0, 30));
      const rows = s.rows || [];
      if (rows.length === 0) continue;
      const headerKeys = Object.keys(rows[0]);
      ws.addRow(headerKeys.map((h) => h.toString()));
      for (const r of rows) {
        ws.addRow(headerKeys.map((k) => r[k]));
      }
    }
    return await wb.xlsx.writeBuffer();
  }

  // ─── Teacher portal ───────────────────────────────────────────────────────────

  async getTeacherClasses(teacherId: number) {
    // Only DISTRIBUTED classes from the ACTIVE year — a new year starts clean.
    const classes = await this.classRepo.query(
      `SELECT c.id, c.name, c.p_level_id, pl.name AS p_level_name,
              (SELECT COUNT(*) FROM students s WHERE s.current_class_id = c.id) AS student_count
       FROM classes c
       JOIN p_levels pl ON pl.id = c.p_level_id
       WHERE c.teacher_id = $1
         AND c.status = 'active'
         AND c.distributed_at IS NOT NULL
         AND pl.academic_year_id = (SELECT id FROM academic_years WHERE status = 'active' ORDER BY created_at DESC LIMIT 1)
       ORDER BY pl.name ASC, c.name ASC`,
      [teacherId],
    );
    return classes.map((c: any) => ({
      id: c.id,
      name: c.name,
      p_level: { id: c.p_level_id, name: c.p_level_name },
      student_count: Number(c.student_count ?? 0),
    }));
  }

  async getClassStudents(classId: number) {
    return this.studentRepo.find({
      where: { current_class_id: classId },
      order: { rank: 'ASC' },
    });
  }

  async getClassWithPLevel(classId: number) {
    const rows = await this.classRepo.query(
      `SELECT c.name, pl.name AS p_level_name
       FROM classes c JOIN p_levels pl ON pl.id = c.p_level_id
       WHERE c.id = $1`,
      [classId],
    );
    if (!rows.length) throw new NotFoundException('Class not found');
    return { name: rows[0].name, pLevelName: rows[0].p_level_name };
  }

  // Today's at-a-glance numbers for the teacher dashboard.
  async getTeacherTodaySummary(teacherId: number) {
    const today = new Date().toISOString().split('T')[0];

    const cls = await this.classRepo.query(
      `SELECT COUNT(*)::int AS classes,
              COALESCE(SUM((SELECT COUNT(*) FROM students st WHERE st.current_class_id = c.id)), 0)::int AS students
       FROM classes c
       JOIN p_levels pl ON pl.id = c.p_level_id
       WHERE c.teacher_id = $1 AND c.status = 'active' AND c.distributed_at IS NOT NULL
         AND pl.academic_year_id = (SELECT id FROM academic_years WHERE status = 'active' ORDER BY created_at DESC LIMIT 1)`,
      [teacherId],
    );

    const att = await this.attendanceSessionRepo.query(
      `SELECT COALESCE(SUM(s.present),0)::int AS present,
              COALESCE(SUM(s.absent),0)::int  AS absent,
              COALESCE(SUM(s.late),0)::int    AS late,
              COUNT(*)::int                   AS marked
       FROM attendance_sessions s
       JOIN classes c ON c.id = s.class_id
       JOIN p_levels pl ON pl.id = c.p_level_id
       WHERE c.teacher_id = $1 AND s.date = $2
         AND pl.academic_year_id = (SELECT id FROM academic_years WHERE status = 'active' ORDER BY created_at DESC LIMIT 1)`,
      [teacherId, today],
    );

    const classes = cls[0]?.classes ?? 0;
    const marked = att[0]?.marked ?? 0;
    return {
      classes,
      students: cls[0]?.students ?? 0,
      present: att[0]?.present ?? 0,
      absent: att[0]?.absent ?? 0,
      late: att[0]?.late ?? 0,
      classes_marked: marked,
      classes_pending: Math.max(0, classes - marked),
    };
  }

  // ─── Attendance ────────────────────────────────────────────────────────────

  // Class roster for a given day with each student's attendance status.
  // Once submitted the day is LOCKED (one attendance per day).
  async getClassAttendance(classId: number, date: string) {
    const students = await this.studentRepo.query(
      `SELECT id, name, rank FROM students
       WHERE current_class_id = $1 AND status != 'transferred'
       ORDER BY rank ASC NULLS LAST, name ASC`,
      [classId],
    );
    const marks = await this.attendanceRepo.query(
      `SELECT student_id, status FROM attendance WHERE class_id = $1 AND date = $2`,
      [classId, date],
    );
    const byStudent = new Map<number, string>();
    for (const m of marks) byStudent.set(m.student_id, m.status);

    const session = await this.attendanceSessionRepo.findOne({ where: { class_id: classId, date } });

    const records = students.map((s: any) => ({
      student_id: s.id,
      name: s.name,
      rank: s.rank,
      status: byStudent.get(s.id) ?? 'present',
    }));

    return {
      date,
      class_id: classId,
      locked: !!session,                 // submitted → read-only until reset
      submitted_at: session?.submitted_at ?? null,
      records,
    };
  }

  // Submit attendance for a class on a date — ONE per day. Locks the day,
  // auto-notifies the Dean(s), and archives a session row for history.
  async saveClassAttendance(
    classId: number,
    date: string,
    records: { student_id: number; status: 'present' | 'absent' | 'late' }[],
    markedBy: number,
  ) {
    if (!date) throw new BadRequestException('Date is required');

    const existingSession = await this.attendanceSessionRepo.findOne({ where: { class_id: classId, date } });
    if (existingSession) {
      throw new BadRequestException('Attendance for this day is already submitted. Use Reset to redo it.');
    }

    // Persist per-student marks
    for (const r of records ?? []) {
      const existing = await this.attendanceRepo.findOne({ where: { student_id: r.student_id, date } });
      if (existing) {
        existing.status = r.status;
        existing.class_id = classId;
        existing.marked_by = markedBy;
        await this.attendanceRepo.save(existing);
      } else {
        await this.attendanceRepo.save(
          this.attendanceRepo.create({
            student_id: r.student_id, class_id: classId, date, status: r.status, marked_by: markedBy,
          }),
        );
      }
    }

    const present = (records ?? []).filter(r => r.status === 'present').length;
    const absent = (records ?? []).filter(r => r.status === 'absent').length;
    const late = (records ?? []).filter(r => r.status === 'late').length;
    const total = records?.length ?? 0;

    // Archive the submitted session (locks the day)
    await this.attendanceSessionRepo.save(
      this.attendanceSessionRepo.create({
        class_id: classId, date, marked_by: markedBy,
        present, absent, late, total, submitted_at: new Date(),
      }),
    );

    // Auto-submit to the dean and principal
    await this.notifySupervisorsOfAttendance(classId, date, markedBy, { present, absent, late, total });

    return { message: 'Attendance submitted', locked: true, present, absent, late, total };
  }

  // Reset a day's attendance so the teacher can redo it (mistake correction).
  async resetClassAttendance(classId: number, date: string, teacherId: number) {
    if (!date) throw new BadRequestException('Date is required');
    await this.attendanceRepo.query(
      `DELETE FROM attendance WHERE class_id = $1 AND date = $2`, [classId, date],
    );
    await this.attendanceSessionRepo.query(
      `DELETE FROM attendance_sessions WHERE class_id = $1 AND date = $2`, [classId, date],
    );
    // Inform the dean and principal the record was reset
    await this.notifySupervisorsOfAttendance(classId, date, teacherId, null);
    return { message: 'Attendance reset — you can record it again', locked: false };
  }

  // Submitted attendance history for a teacher's classes (archive view).
  async getTeacherAttendanceHistory(teacherId: number) {
    const rows = await this.attendanceSessionRepo.query(
      `SELECT s.id, s.class_id, s.date::text AS date, s.present, s.absent, s.late, s.total,
              s.submitted_at,
              c.name AS class_name, pl.name AS p_level_name
       FROM attendance_sessions s
       JOIN classes c ON c.id = s.class_id
       JOIN p_levels pl ON pl.id = c.p_level_id
       WHERE c.teacher_id = $1
         AND pl.academic_year_id = (SELECT id FROM academic_years WHERE status = 'active' ORDER BY created_at DESC LIMIT 1)
       ORDER BY s.date DESC, s.submitted_at DESC`,
      [teacherId],
    );
    return rows.map((r: any) => ({
      id: r.id,
      class_id: r.class_id,
      class_label: `${r.p_level_name}${r.class_name}`,
      date: r.date,
      present: r.present, absent: r.absent, late: r.late, total: r.total,
      submitted_at: r.submitted_at,
    }));
  }

  // Notify the dean and principal that attendance was submitted (or reset when
  // summary is null). Both roles supervise attendance, so both are told.
  private async notifySupervisorsOfAttendance(
    classId: number,
    date: string,
    teacherId: number,
    summary: { present: number; absent: number; late: number; total: number } | null,
  ) {
    const info = await this.classRepo.query(
      `SELECT pl.name AS p_level_name, c.name AS class_name, t.name AS teacher_name
       FROM classes c
       JOIN p_levels pl ON pl.id = c.p_level_id
       LEFT JOIN users t ON t.id = $2
       WHERE c.id = $1`,
      [classId, teacherId],
    );
    const label = info[0] ? `${info[0].p_level_name}${info[0].class_name}` : 'a class';
    const teacher = info[0]?.teacher_name ?? 'A teacher';
    const day = new Date(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

    const message = summary
      ? `${teacher} submitted ${label} attendance for ${day}: ${summary.present} present, ${summary.absent} absent, ${summary.late} late.`
      : `${teacher} reset ${label} attendance for ${day} to correct it.`;

    await this.notificationsService.notifyRoles(
      ['dean', 'principal'],
      message,
      summary ? 'info' : 'warning',
      `/attendance/${classId}?date=${date}`,
    );
  }

  // ─── Accountant portal ───────────────────────────────────────────────────────

  async getAllDistributedClasses(academicYearId: number) {
    // Only DISTRIBUTED classes are visible to the accountant.
    const classes = await this.classRepo.query(
      `SELECT c.id, c.name, c.p_level_id, pl.name AS p_level_name
       FROM classes c
       JOIN p_levels pl ON pl.id = c.p_level_id
       WHERE pl.academic_year_id = $1
         AND pl.status = 'active'
         AND c.status = 'active'
         AND c.distributed_at IS NOT NULL
       ORDER BY pl.name ASC, c.name ASC`,
      [academicYearId],
    );
    if (!classes.length) return [];

    const classIds = classes.map((c: any) => c.id);
    const students = await this.studentRepo.query(
      `SELECT id, name, rank, marks_percentage, former_class, current_class_id
       FROM students
       WHERE current_class_id = ANY($1)
       ORDER BY rank ASC NULLS LAST, name ASC`,
      [classIds],
    );

    const byClass = new Map<number, any[]>();
    for (const s of students) {
      if (!byClass.has(s.current_class_id)) byClass.set(s.current_class_id, []);
      byClass.get(s.current_class_id)!.push({
        id: s.id,
        name: s.name,
        rank: s.rank,
        marks_percentage: s.marks_percentage,
        former_class: s.former_class,
      });
    }

    return classes.map((c: any) => ({
      id: c.id,
      name: c.name,
      p_level: { id: c.p_level_id, name: c.p_level_name },
      students: byClass.get(c.id) ?? [],
    }));
  }
}
