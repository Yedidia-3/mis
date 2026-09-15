import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Class } from '../../entities/class.entity';
import { PLevel } from '../../entities/p-level.entity';
import { Subject } from '../../entities/subject.entity';
import { TeachingAssignment } from '../../entities/teaching-assignment.entity';
import { User } from '../../entities/user.entity';

export interface TeacherLoad {
  teacher_id: number;
  teacher_name: string;
  p_level_id: number | null;
  p_level_name: string | null;
  /** Distinct classes they teach in. */
  class_count: number;
  subject_count: number;
  /** Sum of periods_per_week across everything they teach. */
  periods_per_week: number;
  max_periods_per_week: number | null;
  is_overloaded: boolean;
}

/**
 * Who teaches what.
 *
 * The timetable used to ask the dean for this every time, as free text. Holding
 * it once means the timetable, the teacher's portal and assessment permissions
 * all read the same facts.
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
   * replaced, so a deliberate exception survives a re-sync.
   */
  async syncClassTeacherAssignments(classId: number): Promise<TeachingAssignment[]> {
    const cls = await this.classRepo.findOne({ where: { id: classId } });
    if (!cls) throw new NotFoundException('Class not found');

    const pLevel = await this.pLevelRepo.findOne({ where: { id: cls.p_level_id } });
    if (!pLevel) throw new NotFoundException('P-Level not found');

    // Clear previously generated rows — the class teacher may have changed, or
    // been removed entirely.
    await this.assignmentRepo.delete({ class_id: classId, is_auto_generated: true });

    if (pLevel.teaching_model !== 'class_teacher' || !cls.teacher_id) return [];

    const subjects = await this.subjectRepo.find({
      where: { p_level_id: cls.p_level_id, status: 'active' },
    });

    // A subject already assigned by hand keeps its teacher; the generated rows
    // only fill the gaps.
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

  // ─── Explicit assignment, for specialist levels ─────────────────────────────

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
    const teacher = await this.userRepo.findOne({ where: { id: teacherId } });
    if (!teacher) throw new NotFoundException('Teacher not found');
    if (teacher.role !== 'teacher') {
      throw new BadRequestException(`${teacher.name} is not a teacher`);
    }

    const cls = await this.classRepo.findOne({ where: { id: classId } });
    if (!cls) throw new NotFoundException('Class not found');

    if (subjectIds.length) {
      const subjects = await this.subjectRepo.find({ where: { id: In(subjectIds) } });
      if (subjects.length !== subjectIds.length) {
        throw new NotFoundException('One or more subjects were not found');
      }
      // A subject belongs to a level. Assigning P4 Mathematics to a P6 class
      // would produce a timetable nobody can teach.
      const wrongLevel = subjects.filter((s) => s.p_level_id !== cls.p_level_id);
      if (wrongLevel.length) {
        throw new BadRequestException(
          `${wrongLevel.map((s) => s.name).join(', ')} is not taught at this class's level`,
        );
      }

      // Another teacher already holding one of these subjects would double-book
      // the slot, so say who rather than failing on a constraint violation.
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
    }

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

  async removeAssignment(id: number) {
    const assignment = await this.assignmentRepo.findOne({ where: { id } });
    if (!assignment) throw new NotFoundException('Assignment not found');
    await this.assignmentRepo.remove(assignment);
    return { message: 'Assignment removed' };
  }

  // ─── Reading ────────────────────────────────────────────────────────────────

  /** Everything one teacher teaches, with their derived workload. */
  async getTeacherAssignments(teacherId: number) {
    const rows = await this.assignmentRepo.query(
      `SELECT ta.id, ta.is_auto_generated,
              c.id  AS class_id,  c.name AS class_name,
              pl.id AS p_level_id, pl.name AS p_level_name,
              pl.max_periods_per_teacher,
              s.id  AS subject_id, s.name AS subject_name, s.code AS subject_code,
              s.periods_per_week, s.min_consecutive
       FROM teaching_assignments ta
       JOIN classes  c  ON c.id  = ta.class_id
       JOIN p_levels pl ON pl.id = c.p_level_id
       JOIN subjects s  ON s.id  = ta.subject_id
       WHERE ta.teacher_id = $1 AND c.status = 'active'
       ORDER BY pl.name ASC, c.name ASC, s.display_order ASC`,
      [teacherId],
    );

    const periods = rows.reduce((sum: number, r: any) => sum + Number(r.periods_per_week ?? 0), 0);
    const cap = rows.length ? Number(rows[0].max_periods_per_teacher) : null;

    return {
      assignments: rows.map((r: any) => ({
        id: r.id,
        class_id: r.class_id,
        class_label: `${r.p_level_name}${r.class_name}`,
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
        class_count: new Set(rows.map((r: any) => r.class_id)).size,
        subject_count: rows.length,
      },
    };
  }

  /**
   * Every teacher's load, for the dean.
   *
   * Includes teachers with nothing assigned — an unassigned teacher is exactly
   * what a dean needs to notice.
   */
  async listTeacherLoads(academicYearId: number): Promise<TeacherLoad[]> {
    const rows = await this.assignmentRepo.query(
      `SELECT u.id   AS teacher_id, u.name AS teacher_name,
              MIN(pl.id)::int   AS p_level_id,
              MIN(pl.name)      AS p_level_name,
              COUNT(DISTINCT ta.class_id)::int   AS class_count,
              COUNT(ta.id)::int                  AS subject_count,
              COALESCE(SUM(s.periods_per_week), 0)::int AS periods_per_week,
              MIN(pl.max_periods_per_teacher)::int      AS max_periods
       FROM users u
       LEFT JOIN teaching_assignments ta ON ta.teacher_id = u.id
       LEFT JOIN classes  c  ON c.id  = ta.class_id AND c.status = 'active'
       LEFT JOIN p_levels pl ON pl.id = c.p_level_id AND pl.academic_year_id = $1
       LEFT JOIN subjects s  ON s.id  = ta.subject_id
       WHERE u.role = 'teacher' AND u.status = 'active'
       GROUP BY u.id, u.name
       ORDER BY u.name ASC`,
      [academicYearId],
    );

    return rows.map((r: any) => ({
      teacher_id: r.teacher_id,
      teacher_name: r.teacher_name,
      p_level_id: r.p_level_id ?? null,
      p_level_name: r.p_level_name ?? null,
      class_count: r.class_count ?? 0,
      subject_count: r.subject_count ?? 0,
      periods_per_week: r.periods_per_week ?? 0,
      max_periods_per_week: r.max_periods ?? null,
      is_overloaded: r.max_periods !== null && (r.periods_per_week ?? 0) > r.max_periods,
    }));
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
}
