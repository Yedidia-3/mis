import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Class } from '../../entities/class.entity';
import { PLevel } from '../../entities/p-level.entity';
import { Subject } from '../../entities/subject.entity';
import { TeachingAssignment } from '../../entities/teaching-assignment.entity';
import { User } from '../../entities/user.entity';
import { ClassSubjectAssignmentDto } from './dto/teaching.dto';

export interface TeacherLoad {
  teacher_id: number;
  teacher_name: string;
  email: string;
  avatar: string | null;
  /** Levels this teacher works in this year, e.g. ["P1", "P4"]. */
  levels: string[];
  /** Distinct classes they teach in. */
  class_count: number;
  subject_count: number;
  /** Sum of periods_per_week across everything they teach this year. */
  periods_per_week: number;
  max_periods_per_week: number | null;
  is_overloaded: boolean;
}

/**
 * Who teaches what.
 *
 * The timetable used to ask the dean for this every time, as free text. Holding
 * it once means the timetable, the teacher's portal and assessment permissions
 * all read the same facts. One teacher may hold subjects in several classes
 * across several levels — that is the normal specialist pattern.
 */
@Injectable()
export class TeachingService {
  constructor(
    @InjectRepository(TeachingAssignment) private assignmentRepo: Repository<TeachingAssignment>,
    @InjectRepository(Class) private classRepo: Repository<Class>,
    @InjectRepository(Subject) private subjectRepo: Repository<Subject>,
    @InjectRepository(PLevel) private pLevelRepo: Repository<PLevel>,
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {}

  // ─── Automation for levels where one teacher takes everything ───────────────

  /**
   * Give a class teacher every subject at their level.
   *
   * At a 'class_teacher' level, assigning the teacher to the class already
   * says what they teach — everything — so making the dean tick each subject
   * would be asking for information the system holds. This fills it in.
   *
   * Rows already entered by hand are left alone: only generated rows are
   * replaced, so a deliberate exception (a specialist taking one subject in a
   * class-teacher level) survives a re-sync.
   */
  async syncClassTeacherAssignments(classId: number): Promise<TeachingAssignment[]> {
    const cls = await this.classRepo.findOne({ where: { id: classId } });
    if (!cls) throw new NotFoundException('Class not found');

    const pLevel = await this.pLevelRepo.findOne({ where: { id: cls.p_level_id } });
    if (!pLevel) throw new NotFoundException('P-Level not found');

    await this.assignmentRepo.delete({ class_id: classId, is_auto_generated: true });

    if (pLevel.teaching_model !== 'class_teacher' || !cls.teacher_id) return [];

    const subjects = await this.subjectRepo.find({
      where: { p_level_id: cls.p_level_id, status: 'active' },
    });

    const manual = await this.assignmentRepo.find({
      where: { class_id: classId, is_auto_generated: false },
    });
    const taken = new Set(manual.map((a) => a.subject_id));

    const created = subjects
      .filter((s) => !taken.has(s.id))
      .map((s) =>
        this.assignmentRepo.create({
          teacher_id: cls.teacher_id,
          class_id: classId,
          subject_id: s.id,
          is_auto_generated: true,
        }),
      );

    return created.length ? this.assignmentRepo.save(created) : [];
  }

  // ─── Explicit assignment ─────────────────────────────────────────────────────

  /**
   * Set exactly which subjects a teacher takes in a class.
   *
   * Replaces that teacher's assignments for the class, so the dean's form
   * describes the desired end state rather than accumulating rows.
   */
  async assignSubjects(
    teacherId: number,
    classId: number,
    subjectIds: number[],
  ): Promise<TeachingAssignment[]> {
    await this.assertTeacher(teacherId);
    await this.assertAssignable(classId, subjectIds, teacherId);

    await this.assignmentRepo.delete({ teacher_id: teacherId, class_id: classId });

    if (!subjectIds.length) return [];

    return this.assignmentRepo.save(
      subjectIds.map((subject_id) =>
        this.assignmentRepo.create({
          teacher_id: teacherId,
          class_id: classId,
          subject_id,
          is_auto_generated: false,
        }),
      ),
    );
  }

  /** Assign one teacher across several classes in a single save. */
  async assignBatch(teacherId: number, assignments: ClassSubjectAssignmentDto[]) {
    await this.assertTeacher(teacherId);

    const seen = new Set<number>();
    for (const row of assignments) {
      if (seen.has(row.class_id)) {
        throw new BadRequestException(`Class ${row.class_id} appears more than once in this save`);
      }
      seen.add(row.class_id);
    }

    // Validate everything before writing, so a bad row cannot leave a half-applied save.
    for (const row of assignments) {
      await this.assertAssignable(row.class_id, row.subject_ids, teacherId);
    }

    const saved: TeachingAssignment[] = [];
    for (const row of assignments) {
      await this.assignmentRepo.delete({ teacher_id: teacherId, class_id: row.class_id });
      if (!row.subject_ids.length) continue;
      const created = await this.assignmentRepo.save(
        row.subject_ids.map((subject_id) =>
          this.assignmentRepo.create({
            teacher_id: teacherId,
            class_id: row.class_id,
            subject_id,
            is_auto_generated: false,
          }),
        ),
      );
      saved.push(...created);
    }

    return this.getTeacherAssignments(teacherId);
  }

  async removeAssignment(id: number) {
    const assignment = await this.assignmentRepo.findOne({ where: { id } });
    if (!assignment) throw new NotFoundException('Assignment not found');
    await this.assignmentRepo.remove(assignment);
    return { message: 'Assignment removed' };
  }

  private async assertTeacher(teacherId: number) {
    const teacher = await this.userRepo.findOne({ where: { id: teacherId } });
    if (!teacher) throw new NotFoundException('Teacher not found');
    if (teacher.role !== 'teacher') {
      throw new BadRequestException(`${teacher.name} is not a teacher`);
    }
    if (teacher.status !== 'active') {
      throw new BadRequestException(`${teacher.name} is not an active teacher`);
    }
    return teacher;
  }

  private async assertAssignable(classId: number, subjectIds: number[], teacherId: number) {
    const cls = await this.classRepo.findOne({ where: { id: classId } });
    if (!cls) throw new NotFoundException('Class not found');
    if (cls.status !== 'active') {
      throw new BadRequestException('That class is not active');
    }

    if (!subjectIds.length) return cls;

    const subjects = await this.subjectRepo.find({ where: { id: In(subjectIds) } });
    if (subjects.length !== subjectIds.length) {
      throw new NotFoundException('One or more subjects were not found');
    }
    const wrongLevel = subjects.filter((s) => s.p_level_id !== cls.p_level_id);
    if (wrongLevel.length) {
      throw new BadRequestException(
        `${wrongLevel.map((s) => s.name).join(', ')} is not taught at this class's level`,
      );
    }
    const inactive = subjects.filter((s) => s.status !== 'active');
    if (inactive.length) {
      throw new BadRequestException(
        `${inactive.map((s) => s.name).join(', ')} is not an active subject`,
      );
    }

    const clashes = await this.assignmentRepo.find({
      where: { class_id: classId, subject_id: In(subjectIds) },
      relations: ['teacher', 'subject'],
    });
    const foreign = clashes.filter((c) => c.teacher_id !== teacherId);
    if (foreign.length) {
      const detail = foreign
        .map((c) => `${c.subject?.name ?? 'A subject'} is taught by ${c.teacher?.name ?? 'someone else'}`)
        .join('; ');
      throw new BadRequestException(`${detail}. Remove that assignment first.`);
    }

    return cls;
  }

  // ─── Reading ────────────────────────────────────────────────────────────────

  /** Everything one teacher teaches, with their derived workload. */
  async getTeacherAssignments(teacherId: number, academicYearId?: number) {
    const teacher = await this.userRepo.findOne({ where: { id: teacherId } });
    if (!teacher || teacher.role !== 'teacher') throw new NotFoundException('Teacher not found');

    const year = academicYearId ?? (await this.activeYearId());
    const rows = await this.assignmentRepo.query(
      `SELECT ta.id, ta.is_auto_generated,
              c.id  AS class_id,  c.name AS class_name,
              pl.id AS p_level_id, pl.name AS p_level_name, pl.teaching_model,
              pl.max_periods_per_teacher,
              s.id  AS subject_id, s.name AS subject_name, s.code AS subject_code,
              s.periods_per_week, s.min_consecutive
       FROM teaching_assignments ta
       JOIN classes  c  ON c.id  = ta.class_id
       JOIN p_levels pl ON pl.id = c.p_level_id
       JOIN subjects s  ON s.id  = ta.subject_id
       WHERE ta.teacher_id = $1
         AND c.status = 'active'
         AND ($2::int IS NULL OR pl.academic_year_id = $2)
       ORDER BY pl.name ASC, c.name ASC, s.display_order ASC`,
      [teacherId, year],
    );

    const periods = rows.reduce((sum: number, r: any) => sum + Number(r.periods_per_week ?? 0), 0);
    const caps = rows
      .map((r: any) => (r.max_periods_per_teacher == null ? null : Number(r.max_periods_per_teacher)))
      .filter((n: number | null): n is number => n !== null);
    const cap = caps.length ? Math.min(...caps) : null;
    const levels = [...new Set(rows.map((r: any) => r.p_level_name as string))];

    // Group by class so the dean sees "P4A → English, Science" rather than a flat list.
    const byClass = new Map<number, any>();
    for (const r of rows) {
      let group = byClass.get(r.class_id);
      if (!group) {
        group = {
          class_id: r.class_id,
          class_label: `${r.p_level_name}${r.class_name}`,
          p_level_id: r.p_level_id,
          p_level_name: r.p_level_name,
          teaching_model: r.teaching_model,
          subjects: [] as any[],
        };
        byClass.set(r.class_id, group);
      }
      group.subjects.push({
        assignment_id: r.id,
        subject_id: r.subject_id,
        subject_name: r.subject_name,
        subject_code: r.subject_code,
        periods_per_week: Number(r.periods_per_week ?? 0),
        is_auto_generated: r.is_auto_generated,
      });
    }

    return {
      teacher: {
        id: teacher.id,
        name: teacher.name,
        email: teacher.email,
        avatar: teacher.avatar ?? null,
      },
      academic_year_id: year,
      levels,
      classes: [...byClass.values()],
      assignments: rows.map((r: any) => ({
        id: r.id,
        class_id: r.class_id,
        class_label: `${r.p_level_name}${r.class_name}`,
        p_level_id: r.p_level_id,
        p_level_name: r.p_level_name,
        subject_id: r.subject_id,
        subject_name: r.subject_name,
        subject_code: r.subject_code,
        periods_per_week: Number(r.periods_per_week ?? 0),
        min_consecutive: Number(r.min_consecutive ?? 1),
        is_auto_generated: r.is_auto_generated,
      })),
      load: {
        periods_per_week: periods,
        max_periods_per_week: cap,
        is_overloaded: cap !== null && periods > cap,
        class_count: byClass.size,
        subject_count: rows.length,
      },
    };
  }

  /**
   * Every teacher's load for the year.
   *
   * Includes teachers with nothing assigned — an unassigned teacher is exactly
   * what a dean needs to notice.
   */
  async listTeacherLoads(academicYearId: number): Promise<TeacherLoad[]> {
    await this.assertYear(academicYearId);

    const rows = await this.assignmentRepo.query(
      `SELECT u.id AS teacher_id, u.name AS teacher_name, u.email, u.avatar,
              COALESCE(
                array_agg(DISTINCT pl.name ORDER BY pl.name)
                  FILTER (WHERE pl.id IS NOT NULL),
                '{}'
              ) AS levels,
              COUNT(DISTINCT c.id) FILTER (WHERE pl.id IS NOT NULL)::int AS class_count,
              COUNT(ta.id) FILTER (WHERE pl.id IS NOT NULL)::int AS subject_count,
              COALESCE(SUM(s.periods_per_week) FILTER (WHERE pl.id IS NOT NULL), 0)::int AS periods_per_week,
              MIN(pl.max_periods_per_teacher) FILTER (WHERE pl.id IS NOT NULL)::int AS max_periods
       FROM users u
       LEFT JOIN teaching_assignments ta ON ta.teacher_id = u.id
       LEFT JOIN classes c ON c.id = ta.class_id AND c.status = 'active'
       LEFT JOIN p_levels pl ON pl.id = c.p_level_id AND pl.academic_year_id = $1
       LEFT JOIN subjects s ON s.id = ta.subject_id
       WHERE u.role = 'teacher' AND u.status = 'active'
       GROUP BY u.id, u.name, u.email, u.avatar
       ORDER BY
         CASE WHEN COUNT(ta.id) FILTER (WHERE pl.id IS NOT NULL) = 0 THEN 0 ELSE 1 END,
         u.name ASC`,
      [academicYearId],
    );

    return rows.map((r: any) => {
      const levels: string[] = Array.isArray(r.levels) ? r.levels.filter(Boolean) : [];
      return {
        teacher_id: r.teacher_id,
        teacher_name: r.teacher_name,
        email: r.email,
        avatar: r.avatar ?? null,
        levels,
        class_count: Number(r.class_count ?? 0),
        subject_count: Number(r.subject_count ?? 0),
        periods_per_week: Number(r.periods_per_week ?? 0),
        max_periods_per_week: r.max_periods ?? null,
        is_overloaded: r.max_periods !== null && Number(r.periods_per_week ?? 0) > r.max_periods,
      };
    });
  }

  /**
   * Per-class coverage for the year: which subjects have a teacher, and which
   * still need one. The dean uses this to finish distributing courses.
   */
  async classCoverage(academicYearId: number) {
    await this.assertYear(academicYearId);

    const classes = await this.assignmentRepo.query(
      `SELECT c.id AS class_id, c.name AS class_name, c.teacher_id AS class_teacher_id,
              u.name AS class_teacher_name,
              pl.id AS p_level_id, pl.name AS p_level_name, pl.teaching_model,
              c.distributed_at IS NOT NULL AS distributed
       FROM classes c
       JOIN p_levels pl ON pl.id = c.p_level_id
       LEFT JOIN users u ON u.id = c.teacher_id
       WHERE pl.academic_year_id = $1 AND c.status = 'active'
       ORDER BY pl.name ASC, c.name ASC`,
      [academicYearId],
    );

    const subjects = await this.assignmentRepo.query(
      `SELECT s.id, s.name, s.code, s.p_level_id, s.periods_per_week, s.display_order
       FROM subjects s
       JOIN p_levels pl ON pl.id = s.p_level_id
       WHERE pl.academic_year_id = $1 AND s.status = 'active'
       ORDER BY s.display_order ASC, s.name ASC`,
      [academicYearId],
    );

    const assigned = await this.assignmentRepo.query(
      `SELECT ta.class_id, ta.subject_id, ta.teacher_id, ta.is_auto_generated,
              u.name AS teacher_name
       FROM teaching_assignments ta
       JOIN classes c ON c.id = ta.class_id
       JOIN p_levels pl ON pl.id = c.p_level_id
       JOIN users u ON u.id = ta.teacher_id
       WHERE pl.academic_year_id = $1 AND c.status = 'active'`,
      [academicYearId],
    );

    const byClassSubject = new Map<string, any>();
    for (const a of assigned) {
      byClassSubject.set(`${a.class_id}:${a.subject_id}`, a);
    }

    const byLevel = new Map<number, any[]>();
    for (const s of subjects) {
      const list = byLevel.get(s.p_level_id) ?? [];
      list.push(s);
      byLevel.set(s.p_level_id, list);
    }

    return {
      academic_year_id: academicYearId,
      classes: classes.map((c: any) => {
        const levelSubjects = byLevel.get(c.p_level_id) ?? [];
        const rows = levelSubjects.map((s: any) => {
          const hit = byClassSubject.get(`${c.class_id}:${s.id}`);
          return {
            subject_id: s.id,
            subject_name: s.name,
            subject_code: s.code,
            periods_per_week: Number(s.periods_per_week ?? 0),
            teacher_id: hit?.teacher_id ?? null,
            teacher_name: hit?.teacher_name ?? null,
            is_auto_generated: hit?.is_auto_generated ?? false,
            unassigned: !hit,
          };
        });
        const unassigned = rows.filter((r: any) => r.unassigned).length;
        return {
          class_id: c.class_id,
          class_label: `${c.p_level_name}${c.class_name}`,
          p_level_id: c.p_level_id,
          p_level_name: c.p_level_name,
          teaching_model: c.teaching_model,
          class_teacher_id: c.class_teacher_id,
          class_teacher_name: c.class_teacher_name,
          distributed: c.distributed,
          subject_count: rows.length,
          assigned_count: rows.length - unassigned,
          unassigned_count: unassigned,
          subjects: rows,
        };
      }),
    };
  }

  /**
   * Everything the assignment dialog needs: levels → classes → subjects for
   * the year, plus which teacher currently holds each class/subject.
   */
  async assignmentBoard(academicYearId: number) {
    const coverage = await this.classCoverage(academicYearId);
    const teachers = await this.userRepo.find({
      where: { role: 'teacher', status: 'active' },
      order: { name: 'ASC' },
      select: ['id', 'name', 'email', 'avatar'],
    });

    return {
      academic_year_id: academicYearId,
      teachers: teachers.map((t) => ({
        id: t.id, name: t.name, email: t.email, avatar: t.avatar ?? null,
      })),
      classes: coverage.classes,
    };
  }

  /** Does this teacher teach this subject to this class? Used for permissions. */
  async teaches(teacherId: number, classId: number, subjectId: number): Promise<boolean> {
    const count = await this.assignmentRepo.count({
      where: { teacher_id: teacherId, class_id: classId, subject_id: subjectId },
    });
    return count > 0;
  }

  /** Subjects this teacher may record marks for in a given class. */
  async subjectsFor(teacherId: number, classId: number) {
    return this.assignmentRepo.query(
      `SELECT s.id, s.name, s.code
       FROM teaching_assignments ta
       JOIN subjects s ON s.id = ta.subject_id
       WHERE ta.teacher_id = $1 AND ta.class_id = $2
       ORDER BY s.display_order ASC, s.name ASC`,
      [teacherId, classId],
    );
  }

  private async activeYearId(): Promise<number | null> {
    const rows = await this.classRepo.query(
      `SELECT id FROM academic_years WHERE status = 'active' ORDER BY id DESC LIMIT 1`,
    );
    return rows[0]?.id ?? null;
  }

  private async assertYear(academicYearId: number) {
    const rows = await this.classRepo.query(
      `SELECT id FROM academic_years WHERE id = $1`,
      [academicYearId],
    );
    if (!rows.length) throw new NotFoundException('Academic year not found');
  }
}
