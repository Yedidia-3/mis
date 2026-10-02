import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as ExcelJS from 'exceljs';
import { Readable } from 'stream';
import { In, Repository } from 'typeorm';
import { AcademicYear } from '../entities/academic-year.entity';
import { AttendanceSession } from '../entities/attendance-session.entity';
import { Attendance } from '../entities/attendance.entity';
import { Class } from '../entities/class.entity';
import { PLevel } from '../entities/p-level.entity';
import { Student } from '../entities/student.entity';
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
              (SELECT COUNT(*) FROM students s WHERE s.current_class_id = c.id) AS student_count,
              (SELECT COUNT(*) FROM students s WHERE s.current_class_id = c.id AND s.approval_status = 'pending') AS pending_imported_count
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
        pending_imported_count: Number(c.pending_imported_count ?? 0),
      });
    }

    return plevels.map((p: any) => {
      const cls = byPl.get(p.id) ?? [];
      return {
        ...p,
        classes: cls,
        class_count: cls.length,
        student_count: cls.reduce((s: number, c: any) => s + c.student_count, 0),
        pending_imported_count: cls.reduce((s: number, c: any) => s + (c.pending_imported_count ?? 0), 0),
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
    // Raw SQL — reliable student counts + teacher name + distribution status + pending imported count.
    const rows = await this.classRepo.query(
      `SELECT c.id, c.name, c.p_level_id, c.teacher_id, c.status, c.distributed_at,
              t.name AS teacher_name,
              (SELECT COUNT(*) FROM students s WHERE s.current_class_id = c.id) AS student_count,
              (SELECT COUNT(*) FROM students s WHERE s.current_class_id = c.id AND s.approval_status = 'pending') AS pending_imported_count
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
      pending_imported_count: Number(c.pending_imported_count ?? 0),
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

  async listStudents(params: {
    academicYearId?: number;
    pLevelId?: number;
    classId?: number;
    search?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const qb = this.studentRepo.createQueryBuilder('s')
      .leftJoinAndSelect('s.current_class', 'c')
      .leftJoinAndSelect('c.p_level', 'pl')
      .leftJoinAndSelect('s.academic_year', 'ay')
      .leftJoinAndSelect('s.imported_by_user', 'ibu')
      .leftJoinAndSelect('s.approved_by_user', 'abu');

    if (params.academicYearId) {
      qb.andWhere('s.academic_year_id = :yearId', { yearId: params.academicYearId });
    } else {
      qb.andWhere(
        's.academic_year_id = COALESCE((SELECT id FROM academic_years WHERE status = \'active\' ORDER BY created_at DESC LIMIT 1), s.academic_year_id)'
      );
    }

    if (params.pLevelId) {
      qb.andWhere('c.p_level_id = :plId', { plId: params.pLevelId });
    }

    if (params.classId) {
      qb.andWhere('s.current_class_id = :classId', { classId: params.classId });
    }

    if (params.status) {
      qb.andWhere('s.status = :status', { status: params.status });
    }

    if (params.search && params.search.trim()) {
      const term = `%${params.search.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(s.name) LIKE :term OR LOWER(COALESCE(s.student_id_number, \'\')) LIKE :term OR LOWER(COALESCE(c.name, \'\')) LIKE :term)',
        { term }
      );
    }

    qb.orderBy('pl.name', 'ASC')
      .addOrderBy('c.name', 'ASC')
      .addOrderBy('s.rank', 'ASC', 'NULLS LAST')
      .addOrderBy('s.name', 'ASC');

    const page = params.page ? Math.max(1, Number(params.page)) : 1;
    const limit = params.limit ? Math.min(2000, Math.max(1, Number(params.limit))) : 500;
    qb.skip((page - 1) * limit).take(limit);

    const [students, total] = await qb.getManyAndCount();

    return {
      data: students.map((s) => ({
        id: s.id,
        student_id_number: s.student_id_number,
        name: s.name,
        academic_year_id: s.academic_year_id,
        academic_year_name: s.academic_year?.name,
        current_class_id: s.current_class_id,
        class_name: s.current_class?.name,
        p_level_id: s.current_class?.p_level_id,
        p_level_name: s.current_class?.p_level?.name,
        former_class: s.former_class,
        rank: s.rank,
        marks_percentage: s.marks_percentage,
        status: s.status,
        is_imported: s.is_imported,
        approval_status: s.approval_status,
        imported_at: s.imported_at,
        imported_by_user_id: s.imported_by_user_id,
        imported_by: s.imported_by_user ? {
          id: s.imported_by_user.id,
          name: s.imported_by_user.name,
          email: s.imported_by_user.email,
          role: s.imported_by_user.role,
        } : null,
        approved_by_user_id: s.approved_by_user_id,
        approved_at: s.approved_at,
        created_at: s.created_at,
        updated_at: s.updated_at,
      })),
      total,
      page,
      limit,
    };
  }

  async getStudent(studentId: number) {
    const student = await this.studentRepo.findOne({
      where: { id: studentId },
      relations: ['current_class', 'current_class.p_level', 'academic_year', 'imported_by_user', 'approved_by_user'],
    });
    if (!student) throw new NotFoundException('Student not found');
    return {
      id: student.id,
      student_id_number: student.student_id_number,
      name: student.name,
      academic_year_id: student.academic_year_id,
      academic_year_name: student.academic_year?.name,
      current_class_id: student.current_class_id,
      class_name: student.current_class?.name,
      p_level_id: student.current_class?.p_level_id,
      p_level_name: student.current_class?.p_level?.name,
      former_class: student.former_class,
      rank: student.rank,
      marks_percentage: student.marks_percentage,
      status: student.status,
      is_imported: student.is_imported,
      approval_status: student.approval_status,
      imported_at: student.imported_at,
      imported_by_user_id: student.imported_by_user_id,
      imported_by: student.imported_by_user ? {
        id: student.imported_by_user.id,
        name: student.imported_by_user.name,
        email: student.imported_by_user.email,
        role: student.imported_by_user.role,
      } : null,
      approved_by_user_id: student.approved_by_user_id,
      approved_at: student.approved_at,
      created_at: student.created_at,
      updated_at: student.updated_at,
    };
  }

  async getStudentsByClass(classId: number) {
    return this.studentRepo.find({
      where: { current_class_id: classId },
      order: { rank: 'ASC' },
    });
  }

  async addStudentsToClass(
    classId: number,
    students: Array<{ name?: string; student_id_number?: string; former_class?: string; rank?: number | string; marks_percentage?: number | string }>,
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
          student_id_number: s?.student_id_number ? String(s.student_id_number).trim() : null,
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
      student_id_number: entry.student_id_number,
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

  async createStudent(
    dto: {
      name: string;
      student_id_number?: string;
      academic_year_id?: number;
      class_id?: number;
      p_level_id?: number;
      former_class?: string;
      rank?: number | string;
      marks_percentage?: number | string;
      status?: string;
    },
    user?: User,
  ) {
    const name = String(dto.name ?? '').trim();
    if (!name) throw new BadRequestException('Student name is required');

    let yearId = dto.academic_year_id;
    if (!yearId) {
      const activeYear = await this.yearRepo.findOne({ where: { status: 'active' }, order: { created_at: 'DESC' } });
      if (!activeYear) throw new BadRequestException('No active academic year found. Please create one first.');
      yearId = activeYear.id;
    }

    const year = await this.yearRepo.findOne({ where: { id: yearId } });
    if (!year) throw new NotFoundException('Academic year not found');

    let classId = dto.class_id ? Number(dto.class_id) : null;
    if (!classId && dto.p_level_id) {
      const defaultCls = await this.classRepo.findOne({ where: { p_level_id: dto.p_level_id, status: 'active' }, order: { name: 'ASC' } });
      if (defaultCls) classId = defaultCls.id;
    }

    const studentIdNumber = dto.student_id_number ? String(dto.student_id_number).trim() : null;

    if (studentIdNumber) {
      const dup = await this.studentRepo.findOne({ where: { academic_year_id: yearId, student_id_number: studentIdNumber } });
      if (dup) throw new BadRequestException(`Student with ID ${studentIdNumber} already exists in ${year.name}`);
    }

    const newStudent = this.studentRepo.create({
      name,
      student_id_number: studentIdNumber,
      academic_year_id: yearId,
      current_class_id: classId,
      former_class: dto.former_class?.trim() || null,
      rank: dto.rank !== undefined && Number.isFinite(Number(dto.rank)) ? Number(dto.rank) : null,
      marks_percentage: dto.marks_percentage !== undefined ? this.parseMarks(dto.marks_percentage) : null,
      status: (dto.status as any) || 'active',
    });

    const saved = await this.studentRepo.save(newStudent);

    const uName = user?.name || 'A user';
    await this.notificationsService.notifyRoles(
      ['dean'],
      `${uName} registered new student: "${saved.name}" (ID: ${saved.student_id_number || 'N/A'}) in ${year.name}.`,
      'info',
      `/students?academic_year_id=${yearId}`,
    );

    return this.getStudent(saved.id);
  }

  async updateStudent(
    studentId: number,
    updates: {
      name?: string;
      student_id_number?: string | null;
      current_class_id?: number | null;
      former_class?: string | null;
      rank?: number | string | null;
      marks_percentage?: number | string | null;
      status?: string;
    },
  ) {
    const student = await this.studentRepo.findOne({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Student not found');

    if (updates.name !== undefined) {
      const name = String(updates.name ?? '').trim();
      if (!name) throw new BadRequestException('Student name is required');
      student.name = name;
    }

    if (updates.student_id_number !== undefined) {
      student.student_id_number = updates.student_id_number ? String(updates.student_id_number).trim() : null;
    }

    if (updates.current_class_id !== undefined) {
      student.current_class_id = updates.current_class_id ? Number(updates.current_class_id) : null;
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

    if (updates.status !== undefined && ['active', 'repeating', 'promoted', 'transferred'].includes(updates.status)) {
      student.status = updates.status as any;
    }

    await this.studentRepo.save(student);
    return this.getStudent(student.id);
  }

  async deleteStudent(studentId: number) {
    const student = await this.studentRepo.findOne({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Student not found');
    await this.studentRepo.delete(studentId);
    return { success: true, message: `Student "${student.name}" deleted successfully` };
  }

  async deleteStudentsBulk(ids: number[]) {
    if (!ids || !ids.length) throw new BadRequestException('No student IDs provided');
    const validIds = ids.map(Number).filter(Number.isFinite);
    if (!validIds.length) throw new BadRequestException('Invalid student IDs');
    await this.studentRepo.delete(validIds);
    return { success: true, message: `Deleted ${validIds.length} student(s) successfully` };
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

  /**
   * Helper to parse P-level and Class name from strings like:
   * "P1 A", "P1A", "P2 c", "P3 D", "A", etc.
   */
  private parsePLevelAndClass(
    rawClassStr: string | null | undefined,
    rawSheetName: string | null | undefined,
    fallbackPLevelName?: string,
  ): { pLevelName: string; className: string } {
    const classStr = String(rawClassStr ?? '').trim();
    const sheetName = String(rawSheetName ?? '').trim();

    // 1. Try matching classStr as "P1 A", "P1A", "P1-A", "P 1 A", "Primary 1 A"
    const fullMatch = classStr.match(/^(?:primary\s*|p\s*)?(\d+)\s*[-_/]?\s*([a-zA-Z0-9]+)$/i);
    if (fullMatch) {
      return {
        pLevelName: `P${fullMatch[1]}`,
        className: fullMatch[2].toUpperCase(),
      };
    }

    // 2. Check if sheetName is "P1", "P2", etc.
    const sheetPLevelMatch = sheetName.match(/^(?:primary\s*|p\s*)?(\d+)$/i);
    const detectedSheetPLevel = sheetPLevelMatch ? `P${sheetPLevelMatch[1]}` : null;

    // 3. Check if sheetName is "P1 A", "P1A", "P1-A"
    const sheetFullMatch = sheetName.match(/^(?:primary\s*|p\s*)?(\d+)\s*[-_/]?\s*([a-zA-Z0-9]+)$/i);
    if (sheetFullMatch) {
      return {
        pLevelName: `P${sheetFullMatch[1]}`,
        className: classStr ? classStr.toUpperCase() : sheetFullMatch[2].toUpperCase(),
      };
    }

    // 4. If classStr is a single stream letter like "A", "B", "C"
    if (/^[a-zA-Z]$/.test(classStr)) {
      const pLevel = detectedSheetPLevel || fallbackPLevelName || 'P1';
      return {
        pLevelName: pLevel.toUpperCase(),
        className: classStr.toUpperCase(),
      };
    }

    // 5. If sheetName is a single stream letter like "A", "B", "C"
    if (/^[a-zA-Z]$/.test(sheetName)) {
      const pLevel = fallbackPLevelName || 'P1';
      return {
        pLevelName: pLevel.toUpperCase(),
        className: sheetName.toUpperCase(),
      };
    }

    // 6. If classStr starts with P-level or just has digits
    if (classStr) {
      const pMatch = classStr.match(/(?:p|primary)\s*(\d)/i);
      const pLevel = pMatch ? `P${pMatch[1]}` : (detectedSheetPLevel || fallbackPLevelName || 'P1');
      return {
        pLevelName: pLevel.toUpperCase(),
        className: classStr.toUpperCase(),
      };
    }

    // 7. Fallback
    return {
      pLevelName: (detectedSheetPLevel || fallbackPLevelName || 'P1').toUpperCase(),
      className: 'A',
    };
  }

  async importStudentsUniversal(
    fileBuffer: Buffer,
    fileName: string,
    options: {
      academicYearId?: number;
      pLevelId?: number;
      classId?: number;
      dryRun?: boolean;
    } = {},
    user?: User,
  ) {
    const workbook = new ExcelJS.Workbook();
    const isCsv = fileName.toLowerCase().endsWith('.csv');

    if (isCsv) {
      await workbook.csv.read(Readable.from(fileBuffer));
    } else {
      try {
        await workbook.xlsx.load(fileBuffer as any);
      } catch (err) {
        await workbook.csv.read(Readable.from(fileBuffer));
      }
    }

    if (!workbook.worksheets.length) {
      throw new BadRequestException('No sheets found in uploaded file');
    }

    // Determine default academic year
    let defaultYear = options.academicYearId
      ? await this.yearRepo.findOne({ where: { id: options.academicYearId } })
      : await this.yearRepo.findOne({ where: { status: 'active' }, order: { created_at: 'DESC' } });

    if (!defaultYear) {
      defaultYear = this.yearRepo.create({ name: '2026/27', status: 'active' });
      defaultYear = await this.yearRepo.save(defaultYear);
    }

    let fallbackPLevelName: string | undefined;
    if (options.pLevelId) {
      const pl = await this.pLevelRepo.findOne({ where: { id: options.pLevelId } });
      if (pl) fallbackPLevelName = pl.name;
    }

    // Caches to speed up processing
    const yearCache = new Map<string, AcademicYear>();
    yearCache.set(defaultYear.name.trim().toLowerCase(), defaultYear);
    yearCache.set(String(defaultYear.id), defaultYear);

    const pLevelCache = new Map<string, PLevel>(); // `${yearId}:${pLevelName.toUpperCase()}`
    const classCache = new Map<string, Class>();   // `${pLevelId}:${className.toUpperCase()}`

    // Preload existing P-Levels and Classes for defaultYear to prevent race conditions and duplicate creation
    const existingPLevels = await this.pLevelRepo.find({
      where: { academic_year_id: defaultYear.id, status: 'active' },
    });
    for (const pl of existingPLevels) {
      pLevelCache.set(`${defaultYear.id}:${pl.name.toUpperCase().trim()}`, pl);
    }

    const existingClasses = await this.classRepo.find({
      where: { status: 'active' },
    });
    for (const c of existingClasses) {
      classCache.set(`${c.p_level_id}:${c.name.toUpperCase().trim()}`, c);
    }

    const getOrCreatePLevel = async (year: AcademicYear, plName: string): Promise<PLevel> => {
      const normName = plName.toUpperCase().trim();
      const key = `${year.id}:${normName}`;
      if (pLevelCache.has(key)) return pLevelCache.get(key)!;

      let pl = await this.pLevelRepo.findOne({
        where: { academic_year_id: year.id, name: normName, status: 'active' },
      });
      if (!pl) {
        pl = this.pLevelRepo.create({
          name: normName,
          academic_year_id: year.id,
          status: 'active',
        });
        pl = await this.pLevelRepo.save(pl);
      }
      pLevelCache.set(key, pl);
      return pl;
    };

    const getOrCreateClass = async (pLevel: PLevel, rawClsName: string): Promise<Class> => {
      let normCls = rawClsName.trim();
      const prefixRegex = new RegExp(`^${pLevel.name}\\s*[-_]?\\s*`, 'i');
      if (prefixRegex.test(normCls)) {
        normCls = normCls.replace(prefixRegex, '').trim();
      }
      normCls = normCls.toUpperCase();
      if (!normCls) normCls = 'A';

      const key = `${pLevel.id}:${normCls}`;
      const fullNameKey = `${pLevel.id}:${pLevel.name} ${normCls}`;
      if (classCache.has(key)) return classCache.get(key)!;
      if (classCache.has(fullNameKey)) return classCache.get(fullNameKey)!;

      let cls = await this.classRepo.findOne({
        where: [
          { p_level_id: pLevel.id, name: normCls, status: 'active' },
          { p_level_id: pLevel.id, name: `${pLevel.name} ${normCls}`, status: 'active' },
        ],
      });
      if (!cls) {
        cls = this.classRepo.create({
          name: normCls,
          p_level_id: pLevel.id,
          status: 'active',
        });
        cls = await this.classRepo.save(cls);
      }
      classCache.set(key, cls);
      classCache.set(fullNameKey, cls);
      return cls;
    };

    // Preload existing students for default year for instant deduplication
    const existingStudents = await this.studentRepo.find({
      where: { academic_year_id: defaultYear.id },
    });
    const byIdNumber = new Map<string, Student>();
    const byCleanNameAndClass = new Map<string, Student>();
    const byCleanName = new Map<string, Student>();

    for (const s of existingStudents) {
      if (s.student_id_number && s.student_id_number.trim()) {
        byIdNumber.set(s.student_id_number.trim().toLowerCase(), s);
      }
      const cName = s.name.trim().toLowerCase().replace(/\s+/g, ' ');
      byCleanName.set(cName, s);
      if (s.current_class_id) {
        byCleanNameAndClass.set(`${s.current_class_id}:${cName}`, s);
      }
    }

    const studentsToCreate: Student[] = [];
    const studentsToUpdate: Student[] = [];
    let unchangedCount = 0;
    const warnings: string[] = [];
    const classesAffected = new Set<string>();
    const pLevelsAffected = new Set<string>();

    for (const sheet of workbook.worksheets) {
      const rawSheetName = sheet.name.trim();

      // Find header row in first 5 rows
      let headerRowIndex = -1;
      const colMap = {
        studentId: -1,
        name: -1,
        academicYear: -1,
        class: -1,
        rank: -1,
        marks: -1,
        formerClass: -1,
      };

      sheet.eachRow((row, rowNum) => {
        if (headerRowIndex !== -1 || rowNum > 5) return;
        const values = (row.values as any[]) || [];
        for (let c = 1; c < values.length; c++) {
          const header = String(values[c] ?? '').trim().toLowerCase();
          if (!header) continue;
          if (['student id', 'student_id', 'studentid', 'id', 'reg no', 'reg_no', 'reg number', 'registration number', 'code'].includes(header)) {
            colMap.studentId = c;
          } else if (['name', 'student name', 'full name', 'fullname', 'names', 'nom'].includes(header)) {
            colMap.name = c;
          } else if (['academic year', 'academic_year', 'academicyear', 'year', 'ay', 'annee'].includes(header)) {
            colMap.academicYear = c;
          } else if (['class', 'classe', 'section', 'grade', 'stream', 'class name'].includes(header)) {
            colMap.class = c;
          } else if (['rank', 'position'].includes(header)) {
            colMap.rank = c;
          } else if (['marks', 'marks %', 'marks percentage', 'marks_percentage', 'score', 'percentage'].includes(header)) {
            colMap.marks = c;
          } else if (['former class', 'former_class', 'previous class'].includes(header)) {
            colMap.formerClass = c;
          }
        }
        if (colMap.name !== -1) {
          headerRowIndex = rowNum;
        }
      });

      if (headerRowIndex === -1) {
        headerRowIndex = 1;
        colMap.studentId = 1;
        colMap.name = 2;
        colMap.academicYear = 3;
        colMap.class = 4;
      }

      // Collect rows to process sequentially
      const sheetRows: Array<{
        rowNum: number;
        name: string;
        studentIdNumber?: string;
        academicYearName?: string;
        classVal: string;
        rank?: number;
        marks: number | null;
        formerClass?: string;
      }> = [];

      sheet.eachRow((row, rowNum) => {
        if (rowNum <= headerRowIndex) return;

        const rawName = colMap.name !== -1 ? row.getCell(colMap.name).value : null;
        const name = String(rawName ?? '').trim().replace(/\s+/g, ' ');
        if (!name) return;

        const rawId = colMap.studentId !== -1 ? row.getCell(colMap.studentId).value : null;
        const studentIdNumber = rawId !== null && rawId !== undefined && String(rawId).trim() !== ''
          ? String(rawId).trim()
          : undefined;

        const rawYear = colMap.academicYear !== -1 ? row.getCell(colMap.academicYear).value : null;
        const academicYearName = rawYear ? String(rawYear).trim() : undefined;

        const rawClass = colMap.class !== -1 ? row.getCell(colMap.class).value : null;
        const classVal = rawClass ? String(rawClass).trim() : '';

        const rawRank = colMap.rank !== -1 ? row.getCell(colMap.rank).value : null;
        const rank = rawRank && Number.isFinite(Number(rawRank)) ? Number(rawRank) : undefined;

        const rawMarks = colMap.marks !== -1 ? row.getCell(colMap.marks).value : null;
        const marks = this.parseMarks(rawMarks);

        const rawFormer = colMap.formerClass !== -1 ? row.getCell(colMap.formerClass).value : null;
        const formerClass = rawFormer ? String(rawFormer).trim() : undefined;

        sheetRows.push({
          rowNum,
          name,
          studentIdNumber,
          academicYearName,
          classVal,
          rank,
          marks,
          formerClass,
        });
      });

      for (const item of sheetRows) {
        const { pLevelName, className } = this.parsePLevelAndClass(item.classVal, rawSheetName, fallbackPLevelName);

        let targetYear = defaultYear!;
        if (item.academicYearName) {
          const yrKey = item.academicYearName.toLowerCase().trim();
          if (yearCache.has(yrKey)) {
            targetYear = yearCache.get(yrKey)!;
          } else {
            let foundYear = await this.yearRepo.findOne({
              where: [{ name: item.academicYearName }, { name: item.academicYearName.replace('/', '-') }],
            });
            if (!foundYear) {
              foundYear = this.yearRepo.create({ name: item.academicYearName, status: 'active' });
              foundYear = await this.yearRepo.save(foundYear);
            }
            yearCache.set(yrKey, foundYear);
            targetYear = foundYear;
          }
        }

        const pLevel = await getOrCreatePLevel(targetYear, pLevelName);
        const targetClass = await getOrCreateClass(pLevel, className);

        classesAffected.add(`${pLevel.name} ${targetClass.name}`);
        pLevelsAffected.add(pLevel.name);

        const cleanName = item.name.toLowerCase().trim().replace(/\s+/g, ' ');
        const cleanId = item.studentIdNumber ? item.studentIdNumber.toLowerCase().trim() : null;

        let existing: Student | undefined;
        if (cleanId && byIdNumber.has(cleanId)) {
          existing = byIdNumber.get(cleanId);
        } else if (byCleanNameAndClass.has(`${targetClass.id}:${cleanName}`)) {
          existing = byCleanNameAndClass.get(`${targetClass.id}:${cleanName}`);
        } else if (byCleanName.has(cleanName)) {
          existing = byCleanName.get(cleanName);
        }

        if (existing) {
          let changed = false;
          if (existing.current_class_id !== targetClass.id) {
            existing.current_class_id = targetClass.id;
            changed = true;
          }
          if (item.studentIdNumber && !existing.student_id_number) {
            existing.student_id_number = item.studentIdNumber;
            byIdNumber.set(cleanId!, existing);
            changed = true;
          }
          if (item.rank !== undefined && existing.rank !== item.rank) {
            existing.rank = item.rank;
            changed = true;
          }
          if (item.marks !== null && existing.marks_percentage !== item.marks) {
            existing.marks_percentage = item.marks;
            changed = true;
          }
          if (item.formerClass && existing.former_class !== item.formerClass) {
            existing.former_class = item.formerClass;
            changed = true;
          }
          if (changed) {
            studentsToUpdate.push(existing);
          } else {
            unchangedCount++;
          }
        } else {
          const newStudent = this.studentRepo.create({
            name: item.name,
            student_id_number: item.studentIdNumber || null,
            academic_year_id: targetYear.id,
            current_class_id: targetClass.id,
            former_class: item.formerClass || null,
            rank: item.rank || null,
            marks_percentage: item.marks ?? null,
            status: 'active',
            is_imported: true,
            approval_status: 'pending',
            imported_by_user_id: user ? user.id : null,
            imported_at: new Date(),
          });
          studentsToCreate.push(newStudent);
          if (cleanId) byIdNumber.set(cleanId, newStudent);
          byCleanName.set(cleanName, newStudent);
          byCleanNameAndClass.set(`${targetClass.id}:${cleanName}`, newStudent);
        }
      }
    }

    const totalRows = studentsToCreate.length + studentsToUpdate.length + unchangedCount;

    if (!options.dryRun) {
      if (studentsToCreate.length > 0) {
        await this.studentRepo.save(studentsToCreate, { chunk: 100 });
      }
      if (studentsToUpdate.length > 0) {
        await this.studentRepo.save(studentsToUpdate, { chunk: 100 });
      }

      // SINGLE RULE:
      // "the single rule is that when imported who ever was not existing, it should send notification to dean"
      if (studentsToCreate.length > 0) {
        const preview = studentsToCreate.slice(0, 3).map((s) => s.name).join(', ') +
          (studentsToCreate.length > 3 ? ` and ${studentsToCreate.length - 3} more` : '');
        const uName = user?.name || 'A user';
        const notificationMsg = `${uName} imported ${studentsToCreate.length} new student(s) (${preview}) into ${defaultYear.name}.`;
        await this.notificationsService.notifyRoles(
          ['dean'],
          notificationMsg,
          'info',
          `/students?academic_year_id=${defaultYear.id}`,
        );
      }
    }

    return {
      success: true,
      total_rows: totalRows,
      new_count: studentsToCreate.length,
      updated_count: studentsToUpdate.length,
      unchanged_count: unchangedCount,
      new_students: studentsToCreate.map((s) => ({
        id: s.id,
        name: s.name,
        student_id_number: s.student_id_number,
      })),
      classes_affected: Array.from(classesAffected).sort(),
      p_levels_affected: Array.from(pLevelsAffected).sort(),
      message: options.dryRun
        ? `Preview: ${studentsToCreate.length} new student(s), ${studentsToUpdate.length} updated, ${unchangedCount} already up to date.`
        : `Import successful: ${studentsToCreate.length} new student(s) added, ${studentsToUpdate.length} updated, ${unchangedCount} verified with zero duplicates.`,
      warnings,
    };
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
    const students = await this.studentRepo.find({
      where: { current_class_id: classId },
      relations: ['imported_by_user'],
      order: { rank: 'ASC', name: 'ASC' },
    });
    return students.map((s) => ({
      id: s.id,
      student_id_number: s.student_id_number,
      name: s.name,
      academic_year_id: s.academic_year_id,
      current_class_id: s.current_class_id,
      former_class: s.former_class,
      rank: s.rank,
      marks_percentage: s.marks_percentage,
      status: s.status,
      is_imported: s.is_imported,
      approval_status: s.approval_status,
      imported_at: s.imported_at,
      imported_by_user_id: s.imported_by_user_id,
      imported_by: s.imported_by_user ? {
        id: s.imported_by_user.id,
        name: s.imported_by_user.name,
        email: s.imported_by_user.email,
        role: s.imported_by_user.role,
      } : null,
      approved_by_user_id: s.approved_by_user_id,
      approved_at: s.approved_at,
      created_at: s.created_at,
      updated_at: s.updated_at,
    }));
  }

  private async checkAndUpdateClassDistributedStatus(classIds: number[]) {
    const validClassIds = [...new Set(classIds.filter(Boolean))];
    for (const classId of validClassIds) {
      const pendingCount = await this.studentRepo.count({
        where: { current_class_id: classId, approval_status: 'pending' },
      });
      if (pendingCount === 0) {
        await this.classRepo.query(
          `UPDATE classes SET distributed_at = COALESCE(distributed_at, NOW()) WHERE id = $1`,
          [classId],
        );
      }
    }
  }

  async approveStudent(studentId: number, user: User) {
    const student = await this.studentRepo.findOne({
      where: { id: studentId },
      relations: ['current_class'],
    });
    if (!student) throw new NotFoundException('Student not found');

    student.approval_status = 'approved';
    student.approved_by_user_id = user.id;
    student.approved_at = new Date();
    await this.studentRepo.save(student);

    if (student.current_class_id) {
      await this.checkAndUpdateClassDistributedStatus([student.current_class_id]);
    }

    if (student.imported_by_user_id && student.imported_by_user_id !== user.id) {
      const className = student.current_class?.name ? ` in class ${student.current_class.name}` : '';
      await this.notificationsService.notify(
        student.imported_by_user_id,
        `Your imported student "${student.name}"${className} has been approved by ${user.name}.`,
        'success',
        '/students',
      );
    }

    return { success: true, message: `Student "${student.name}" approved successfully` };
  }

  async rejectStudent(studentId: number, user: User) {
    const student = await this.studentRepo.findOne({
      where: { id: studentId },
      relations: ['current_class'],
    });
    if (!student) throw new NotFoundException('Student not found');

    const studentName = student.name;
    const creatorId = student.imported_by_user_id;
    const className = student.current_class?.name ? ` in class ${student.current_class.name}` : '';
    const classId = student.current_class_id;

    await this.studentRepo.delete(student.id);

    if (classId) {
      await this.checkAndUpdateClassDistributedStatus([classId]);
    }

    if (creatorId && creatorId !== user.id) {
      await this.notificationsService.notify(
        creatorId,
        `Your imported student "${studentName}"${className} was rejected and removed by ${user.name}.`,
        'warning',
        '/students',
      );
    }

    return { success: true, message: `Student "${studentName}" rejected and removed successfully` };
  }

  async approveStudentsBulk(ids: number[], user: User) {
    if (!ids || !ids.length) throw new BadRequestException('No student IDs provided');
    const validIds = ids.map(Number).filter(Number.isFinite);
    if (!validIds.length) throw new BadRequestException('Invalid student IDs');

    const students = await this.studentRepo.find({
      where: { id: In(validIds) },
      relations: ['current_class'],
    });
    if (!students.length) return { success: true, count: 0 };

    const now = new Date();
    for (const s of students) {
      s.approval_status = 'approved';
      s.approved_by_user_id = user.id;
      s.approved_at = now;
    }
    await this.studentRepo.save(students);

    const classIds = students.map((s) => s.current_class_id).filter((id): id is number => id != null);
    await this.checkAndUpdateClassDistributedStatus(classIds);

    const byCreator = new Map<number, number>();
    for (const s of students) {
      if (s.imported_by_user_id && s.imported_by_user_id !== user.id) {
        byCreator.set(s.imported_by_user_id, (byCreator.get(s.imported_by_user_id) || 0) + 1);
      }
    }
    for (const [creatorId, count] of byCreator.entries()) {
      await this.notificationsService.notify(
        creatorId,
        `${count} of your imported student(s) have been approved by ${user.name}.`,
        'success',
        '/students',
      );
    }

    return { success: true, count: students.length, message: `Approved ${students.length} student(s) successfully` };
  }

  async rejectStudentsBulk(ids: number[], user: User) {
    if (!ids || !ids.length) throw new BadRequestException('No student IDs provided');
    const validIds = ids.map(Number).filter(Number.isFinite);
    if (!validIds.length) throw new BadRequestException('Invalid student IDs');

    const students = await this.studentRepo.find({
      where: { id: In(validIds) },
    });
    if (!students.length) return { success: true, count: 0 };

    const byCreator = new Map<number, number>();
    for (const s of students) {
      if (s.imported_by_user_id && s.imported_by_user_id !== user.id) {
        byCreator.set(s.imported_by_user_id, (byCreator.get(s.imported_by_user_id) || 0) + 1);
      }
    }

    await this.studentRepo.delete(validIds);

    for (const [creatorId, count] of byCreator.entries()) {
      await this.notificationsService.notify(
        creatorId,
        `${count} of your imported student(s) were rejected and removed by ${user.name}.`,
        'warning',
        '/students',
      );
    }

    return { success: true, count: students.length, message: `Rejected and removed ${students.length} student(s)` };
  }

  async approveClassImports(classId: number, user: User) {
    const students = await this.studentRepo.find({
      where: { current_class_id: classId, approval_status: 'pending' },
    });
    if (!students.length) return { success: true, count: 0, message: 'No pending imported students in this class' };
    return this.approveStudentsBulk(students.map((s) => s.id), user);
  }

  async rejectClassImports(classId: number, user: User) {
    const students = await this.studentRepo.find({
      where: { current_class_id: classId, approval_status: 'pending' },
    });
    if (!students.length) return { success: true, count: 0, message: 'No pending imported students in this class' };
    return this.rejectStudentsBulk(students.map((s) => s.id), user);
  }

  private async assertTeacherOwnsClass(classId: number, user: User) {
    if (user.role !== 'teacher') return;
    const cls = await this.classRepo.findOne({ where: { id: classId, teacher_id: user.id, status: 'active' } });
    if (!cls) throw new ForbiddenException('You can only manage your assigned classes');
  }

  async getClassStudentsForUser(classId: number, user: User) {
    await this.assertTeacherOwnsClass(classId, user);
    return this.getClassStudents(classId);
  }

  async addStudentsToClassForUser(classId: number, students: Array<{ name?: string }>, user: User) {
    await this.assertTeacherOwnsClass(classId, user);
    return this.addStudentsToClass(classId, students);
  }

  async updateStudentForUser(studentId: number, updates: Parameters<AcademicsService['updateStudent']>[1], user: User) {
    const student = await this.studentRepo.findOne({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Student not found');
    await this.assertTeacherOwnsClass(student.current_class_id, user);
    return this.updateStudent(studentId, updates);
  }

  async removeStudentFromClassForUser(studentId: number, user: User) {
    const student = await this.studentRepo.findOne({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Student not found');
    await this.assertTeacherOwnsClass(student.current_class_id, user);
    // Preserve the student and their history; only remove the roster assignment.
    student.current_class_id = null;
    await this.studentRepo.save(student);
    return { message: 'Student removed from the class list' };
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

  async getClassWithPLevelForUser(classId: number, user: User) {
    await this.assertTeacherOwnsClass(classId, user);
    return this.getClassWithPLevel(classId);
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

  async getClassAttendanceForUser(classId: number, date: string, user: User) {
    await this.assertTeacherOwnsClass(classId, user);
    return this.getClassAttendance(classId, date);
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

  async saveClassAttendanceForUser(
    classId: number,
    date: string,
    records: { student_id: number; status: 'present' | 'absent' | 'late' }[],
    user: User,
  ) {
    await this.assertTeacherOwnsClass(classId, user);
    return this.saveClassAttendance(classId, date, records, user.id);
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

  async resetClassAttendanceForUser(classId: number, date: string, user: User) {
    await this.assertTeacherOwnsClass(classId, user);
    return this.resetClassAttendance(classId, date, user.id);
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

  // ─── Distribution Module ───────────────────────────────────────────────────

  async getDistributionSummary(academicYearId?: number) {
    let yearId = academicYearId;
    if (!yearId || isNaN(yearId)) {
      const active = await this.yearRepo.findOne({ where: { status: 'active' }, order: { created_at: 'DESC' } });
      if (!active) return { academic_year: null, classes: [] };
      yearId = active.id;
    }

    const year = await this.yearRepo.findOne({ where: { id: yearId } });
    if (!year) throw new NotFoundException('Academic year not found');

    const rows = await this.classRepo.query(
      `SELECT c.id, c.name, c.p_level_id, pl.name AS p_level_name, c.teacher_id, c.distributed_at,
              t.name AS teacher_name, t.email AS teacher_email,
              (SELECT COUNT(*) FROM students s WHERE s.current_class_id = c.id) AS student_count,
              (SELECT COUNT(*) FROM students s WHERE s.current_class_id = c.id AND s.approval_status = 'pending') AS pending_imported_count,
              (SELECT COUNT(*) FROM students s WHERE s.current_class_id = c.id AND s.approval_status = 'approved') AS approved_student_count
       FROM classes c
       JOIN p_levels pl ON pl.id = c.p_level_id
       LEFT JOIN users t ON t.id = c.teacher_id
       WHERE pl.academic_year_id = $1 AND pl.status = 'active' AND c.status = 'active'
       ORDER BY pl.name ASC, c.name ASC`,
      [yearId],
    );

    const classes = rows.map((r: any) => {
      const pendingCount = Number(r.pending_imported_count ?? 0);
      const studentCount = Number(r.student_count ?? 0);
      const isDistributed = !!r.distributed_at;

      let status: 'pending_approval' | 'ready' | 'distributed' = 'ready';
      if (pendingCount > 0) {
        status = 'pending_approval';
      } else if (isDistributed) {
        status = 'distributed';
      }

      return {
        id: r.id,
        name: r.name,
        p_level_id: r.p_level_id,
        p_level_name: r.p_level_name,
        academic_year_id: year.id,
        academic_year_name: year.name,
        teacher_id: r.teacher_id,
        teacher: r.teacher_id ? { id: r.teacher_id, name: r.teacher_name, email: r.teacher_email } : null,
        distributed_at: r.distributed_at,
        student_count: studentCount,
        pending_imported_count: pendingCount,
        approved_student_count: Number(r.approved_student_count ?? 0),
        status,
      };
    });

    return {
      academic_year: { id: year.id, name: year.name, status: year.status },
      classes,
    };
  }

  async distributeClass(classId: number, body: { teacher_id?: number }, user: User) {
    const cls = await this.classRepo.findOne({
      where: { id: classId, status: 'active' },
      relations: ['p_level', 'p_level.academic_year'],
    });
    if (!cls) throw new NotFoundException('Class not found');

    const pendingCount = await this.studentRepo.count({
      where: { current_class_id: classId, approval_status: 'pending' },
    });
    if (pendingCount > 0) {
      throw new BadRequestException(`Cannot distribute ${cls.p_level?.name}${cls.name} while ${pendingCount} student(s) are pending Dean approval.`);
    }

    if (body.teacher_id !== undefined) {
      cls.teacher_id = body.teacher_id || null;
    }
    cls.distributed_at = new Date();
    const saved = await this.classRepo.save(cls);

    if (saved.teacher_id) {
      await this.teachingService.syncClassTeacherAssignments(saved.id);
      await this.notificationsService.notify(
        saved.teacher_id,
        `You have been assigned to teach ${cls.p_level?.name}${saved.name} (${cls.p_level?.academic_year?.name}).`,
        'info',
        '/teacher/classes',
      );
    }

    await this.notificationsService.notifyRoles(
      ['accountant', 'dean', 'principal'],
      `Class list for ${cls.p_level?.name}${saved.name} (${cls.p_level?.academic_year?.name}) has been distributed and is active.`,
      'success',
      '/accountant/class-lists',
    );

    return {
      success: true,
      message: `Class ${cls.p_level?.name}${saved.name} distributed successfully to teacher and accountant.`,
      class: saved,
    };
  }

  async distributePLevel(pLevelId: number, teacherAssignments: Array<{ class_id: number; teacher_id: number }>, user: User) {
    const pl = await this.pLevelRepo.findOne({
      where: { id: pLevelId, status: 'active' },
      relations: ['academic_year'],
    });
    if (!pl) throw new NotFoundException('P-Level not found');

    const classes = await this.classRepo.find({
      where: { p_level_id: pLevelId, status: 'active' },
    });

    const teacherMap = new Map<number, number>();
    (teacherAssignments ?? []).forEach((ta) => {
      if (ta.class_id && ta.teacher_id) teacherMap.set(ta.class_id, ta.teacher_id);
    });

    const distributed: Class[] = [];
    const now = new Date();

    for (const cls of classes) {
      const pendingCount = await this.studentRepo.count({
        where: { current_class_id: cls.id, approval_status: 'pending' },
      });
      if (pendingCount > 0) continue; // Skip classes with unapproved students

      if (teacherMap.has(cls.id)) {
        cls.teacher_id = teacherMap.get(cls.id)!;
      }
      cls.distributed_at = now;
      const saved = await this.classRepo.save(cls);
      distributed.push(saved);

      if (saved.teacher_id) {
        await this.teachingService.syncClassTeacherAssignments(saved.id);
        await this.notificationsService.notify(
          saved.teacher_id,
          `You have been assigned to teach ${pl.name}${saved.name} (${pl.academic_year?.name}).`,
          'info',
          '/teacher/classes',
        );
      }
    }

    await this.notificationsService.notifyRoles(
      ['accountant', 'dean', 'principal'],
      `Classes in ${pl.name} (${pl.academic_year?.name}) have been distributed and are active.`,
      'success',
      '/accountant/class-lists',
    );

    return {
      success: true,
      distributed_count: distributed.length,
      message: `Distributed ${distributed.length} class(es) in ${pl.name}.`,
    };
  }

  // ─── Accountant portal ───────────────────────────────────────────────────────

  async getAllDistributedClasses(academicYearId?: number) {
    let yearId = academicYearId;
    if (!yearId || isNaN(yearId)) {
      const active = await this.yearRepo.findOne({ where: { status: 'active' }, order: { created_at: 'DESC' } });
      if (!active) return [];
      yearId = active.id;
    }

    // Distributed classes visible to accountant
    const classes = await this.classRepo.query(
      `SELECT c.id, c.name, c.p_level_id, pl.name AS p_level_name, ay.id AS academic_year_id, ay.name AS academic_year_name,
              c.teacher_id, t.name AS teacher_name, c.distributed_at
       FROM classes c
       JOIN p_levels pl ON pl.id = c.p_level_id
       JOIN academic_years ay ON ay.id = pl.academic_year_id
       LEFT JOIN users t ON t.id = c.teacher_id
       WHERE pl.academic_year_id = $1
         AND pl.status = 'active'
         AND c.status = 'active'
         AND c.distributed_at IS NOT NULL
       ORDER BY pl.name ASC, c.name ASC`,
      [yearId],
    );
    if (!classes.length) return [];

    const classIds = classes.map((c: any) => c.id);
    const students = await this.studentRepo.query(
      `SELECT id, student_id_number, name, rank, marks_percentage, former_class, current_class_id, approval_status, is_imported, created_at
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
        student_id_number: s.student_id_number,
        name: s.name,
        rank: s.rank,
        marks_percentage: s.marks_percentage,
        former_class: s.former_class,
        approval_status: s.approval_status,
        is_imported: s.is_imported,
      });
    }

    return classes.map((c: any) => ({
      id: c.id,
      name: c.name,
      p_level: { id: c.p_level_id, name: c.p_level_name },
      academic_year: { id: c.academic_year_id, name: c.academic_year_name },
      teacher: c.teacher_id ? { id: c.teacher_id, name: c.teacher_name } : null,
      distributed_at: c.distributed_at,
      student_count: (byClass.get(c.id) ?? []).length,
      students: byClass.get(c.id) ?? [],
    }));
  }
}
