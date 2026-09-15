import {
  BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Assessment } from '../../entities/assessment.entity';
import { AssessmentScore } from '../../entities/assessment-score.entity';
import { AssessmentType } from '../../entities/assessment-type.entity';
import { Class } from '../../entities/class.entity';
import { CourseCatalogue } from '../../entities/course-catalogue.entity';
import { Student } from '../../entities/student.entity';
import { Subject } from '../../entities/subject.entity';
import { Term } from '../../entities/term.entity';
import { User } from '../../entities/user.entity';
import { NotificationsService } from '../../notifications/notifications.service';
import {
  CreateAssessmentTypeDto, CreateSubjectDto, CreateTermDto,
  UpdateAssessmentTypeDto, UpdateSubjectDto, UpdateTermDto,
  CreateCatalogueEntryDto, UpdateCatalogueEntryDto, AssignPLevelDto,
} from './dto/config.dto';
import { CreateAssessmentDto, SaveScoresDto, UpdateAssessmentDto } from './dto/assessment.dto';
import { summariseAssessment } from './grade-calculator';

/** Roles that supervise teachers' academic records but never edit them. */
const SUPERVISOR_ROLES = ['dean', 'principal', 'super_admin'];

@Injectable()
export class AssessmentsService {
  private readonly logger = new Logger(AssessmentsService.name);

  constructor(
    @InjectRepository(Term) private termRepo: Repository<Term>,
    @InjectRepository(Subject) private subjectRepo: Repository<Subject>,
    @InjectRepository(AssessmentType) private typeRepo: Repository<AssessmentType>,
    @InjectRepository(Assessment) private assessmentRepo: Repository<Assessment>,
    @InjectRepository(AssessmentScore) private scoreRepo: Repository<AssessmentScore>,
    @InjectRepository(Class) private classRepo: Repository<Class>,
    @InjectRepository(Student) private studentRepo: Repository<Student>,
    @InjectRepository(CourseCatalogue) private catalogueRepo: Repository<CourseCatalogue>,
    private notificationsService: NotificationsService,
  ) {}

  // ─── Course catalogue ─────────────────────────────────────────────────────────

  // The 9 standard courses. Seeded automatically on first call if the
  // catalogue is empty — the dean never has to type these.
  private static readonly DEFAULT_COURSES = [
    { name: 'Mathematics',   code: 'MATH',     default_periods_per_week: 6, default_min_consecutive: 2 },
    { name: 'English',       code: 'ENGLISH',  default_periods_per_week: 8, default_min_consecutive: 2 },
    { name: 'Kinyarwanda',   code: 'KINY',     default_periods_per_week: 6, default_min_consecutive: 1 },
    { name: 'Social Studies',code: 'SRS',      default_periods_per_week: 5, default_min_consecutive: 1 },
    { name: 'SET',           code: 'SET',      default_periods_per_week: 5, default_min_consecutive: 2 },
    { name: 'Français',      code: 'FRANCAIS', default_periods_per_week: 6, default_min_consecutive: 1 },
    { name: 'Creative Arts', code: 'CREATIVE', default_periods_per_week: 1, default_min_consecutive: 1 },
    { name: 'Sport',         code: 'SPORT',    default_periods_per_week: 1, default_min_consecutive: 1 },
    { name: 'IT + CL',       code: 'ITCL',     default_periods_per_week: 2, default_min_consecutive: 1 },
  ];

  async listCatalogue() {
    const existing = await this.catalogueRepo.find({ order: { name: 'ASC' } });
    if (existing.length === 0) {
      // First time — seed the standard courses so the dean sees them immediately
      await this.catalogueRepo.save(
        AssessmentsService.DEFAULT_COURSES.map((c) => this.catalogueRepo.create(c)),
      );
      return this.catalogueRepo.find({ where: { status: 'active' }, order: { name: 'ASC' } });
    }
    return existing.filter((c) => c.status === 'active');
  }

  async createCatalogueEntry(dto: CreateCatalogueEntryDto) {
    const clash = await this.catalogueRepo.findOne({ where: { code: dto.code } });
    if (clash) throw new BadRequestException(`A course with code ${dto.code} already exists in the catalogue`);
    return this.catalogueRepo.save(this.catalogueRepo.create(dto));
  }

  async updateCatalogueEntry(id: number, dto: UpdateCatalogueEntryDto) {
    const entry = await this.catalogueRepo.findOne({ where: { id } });
    if (!entry) throw new NotFoundException('Course not found');
    Object.assign(entry, dto);
    return this.catalogueRepo.save(entry);
  }

  async deleteCatalogueEntry(id: number) {
    const entry = await this.catalogueRepo.findOne({ where: { id } });
    if (!entry) throw new NotFoundException('Course not found');
    const used = await this.subjectRepo.count({ where: { catalogue_id: id } });
    if (used) {
      entry.status = 'inactive';
      await this.catalogueRepo.save(entry);
      return { message: 'Course is assigned to p-levels, so it was archived rather than deleted' };
    }
    await this.catalogueRepo.remove(entry);
    return { message: 'Course deleted' };
  }

  /**
   * Assign a set of catalogue courses to a p-level in one shot.
   *
   * Courses already assigned to that level are skipped rather than duplicated.
   * The dean can also pass extra ad-hoc subjects (name + code without a
   * catalogue_id) in the same request for one-off additions.
   */
  async assignPLevel(dto: AssignPLevelDto) {
    const created: Subject[] = [];

    for (const catalogueId of dto.catalogue_ids) {
      const entry = await this.catalogueRepo.findOne({ where: { id: catalogueId } });
      if (!entry) continue;

      const existing = await this.subjectRepo.findOne({
        where: { p_level_id: dto.p_level_id, catalogue_id: catalogueId },
      });
      if (existing) continue;

      // Also guard against a manual subject with the same code already there
      const codeClash = await this.subjectRepo.findOne({
        where: { p_level_id: dto.p_level_id, code: entry.code },
      });
      if (codeClash) continue;

      created.push(
        await this.subjectRepo.save(
          this.subjectRepo.create({
            p_level_id: dto.p_level_id,
            catalogue_id: catalogueId,
            name: entry.name,
            code: entry.code,
            periods_per_week: entry.default_periods_per_week,
            min_consecutive: entry.default_min_consecutive,
          }),
        ),
      );
    }

    return { assigned: created.length, subjects: created };
  }

  // ─── Dean configuration: terms ───────────────────────────────────────────────

  async listTerms(academicYearId: number) {
    return this.termRepo.find({
      where: { academic_year_id: academicYearId },
      order: { sequence: 'ASC' },
    });
  }

  async createTerm(dto: CreateTermDto) {
    if (dto.end_date < dto.start_date) {
      throw new BadRequestException('Term end date cannot precede its start date');
    }
    const clash = await this.termRepo.findOne({
      where: { academic_year_id: dto.academic_year_id, sequence: dto.sequence },
    });
    if (clash) {
      throw new BadRequestException(`Term ${dto.sequence} already exists for this year`);
    }
    return this.termRepo.save(this.termRepo.create(dto));
  }

  async updateTerm(id: number, dto: UpdateTermDto) {
    const term = await this.termRepo.findOne({ where: { id } });
    if (!term) throw new NotFoundException('Term not found');

    Object.assign(term, dto);
    if (term.end_date < term.start_date) {
      throw new BadRequestException('Term end date cannot precede its start date');
    }

    const saved = await this.termRepo.save(term);

    // Closing a term finalises its marks, so the people who sign off on
    // reports need to know it happened.
    if (dto.status === 'closed') {
      await this.notificationsService.notifyRoles(
        ['dean', 'principal'],
        `${term.name} has been closed. Its marks are now final.`,
        'info',
        `/dean/terms`,
      );
    }

    return saved;
  }

  // ─── Dean configuration: subjects ────────────────────────────────────────────

  async listSubjects(pLevelId: number) {
    return this.subjectRepo.find({
      where: { p_level_id: pLevelId, status: 'active' },
      order: { display_order: 'ASC', name: 'ASC' },
    });
  }

  async createSubject(dto: CreateSubjectDto) {
    const clash = await this.subjectRepo.findOne({
      where: { p_level_id: dto.p_level_id, code: dto.code },
    });
    if (clash) {
      throw new BadRequestException(`Subject code ${dto.code} already exists at this level`);
    }
    return this.subjectRepo.save(this.subjectRepo.create(dto));
  }

  async updateSubject(id: number, dto: UpdateSubjectDto) {
    const subject = await this.subjectRepo.findOne({ where: { id } });
    if (!subject) throw new NotFoundException('Subject not found');
    Object.assign(subject, dto);
    return this.subjectRepo.save(subject);
  }

  /**
   * Deactivates rather than deletes once marks exist. A subject with recorded
   * assessments is part of the academic record and removing it would orphan
   * grades that a past report card already reported.
   */
  async deleteSubject(id: number) {
    const subject = await this.subjectRepo.findOne({ where: { id } });
    if (!subject) throw new NotFoundException('Subject not found');

    const used = await this.assessmentRepo.count({ where: { subject_id: id } });
    if (used) {
      subject.status = 'inactive';
      await this.subjectRepo.save(subject);
      return { message: 'Subject has recorded marks, so it was archived rather than deleted' };
    }

    await this.subjectRepo.remove(subject);
    return { message: 'Subject deleted' };
  }

  // ─── Dean configuration: assessment types and their weights ──────────────────

  /**
   * The types a teacher may choose from, with the dean's weights.
   *
   * `weights_total` is reported so the dean can see at a glance whether the
   * policy adds up to 100. It is not enforced: grades normalise by whichever
   * types actually carry marks, so an interim total of 90 or 110 skews nothing
   * — but a dean who meant it to be 100 should be able to see that it isn't.
   */
  async listAssessmentTypes(academicYearId: number) {
    const types = await this.typeRepo.find({
      where: { academic_year_id: academicYearId, status: 'active' },
      order: { display_order: 'ASC', name: 'ASC' },
    });

    const weightsTotal = types.reduce((sum, t) => sum + Number(t.weight), 0);

    return {
      types,
      weights_total: Math.round(weightsTotal * 100) / 100,
      weights_balanced: Math.abs(weightsTotal - 100) < 0.01,
    };
  }

  async createAssessmentType(dto: CreateAssessmentTypeDto) {
    const clash = await this.typeRepo.findOne({
      where: { academic_year_id: dto.academic_year_id, name: dto.name },
    });
    if (clash) throw new BadRequestException(`An assessment type named "${dto.name}" already exists`);
    return this.typeRepo.save(this.typeRepo.create(dto));
  }

  async updateAssessmentType(id: number, dto: UpdateAssessmentTypeDto) {
    const type = await this.typeRepo.findOne({ where: { id } });
    if (!type) throw new NotFoundException('Assessment type not found');
    Object.assign(type, dto);
    return this.typeRepo.save(type);
  }

  async deleteAssessmentType(id: number) {
    const type = await this.typeRepo.findOne({ where: { id } });
    if (!type) throw new NotFoundException('Assessment type not found');

    const used = await this.assessmentRepo.count({ where: { assessment_type_id: id } });
    if (used) {
      type.status = 'inactive';
      await this.typeRepo.save(type);
      return { message: 'Type is used by recorded marks, so it was archived rather than deleted' };
    }

    await this.typeRepo.remove(type);
    return { message: 'Assessment type deleted' };
  }

  // ─── Access control ──────────────────────────────────────────────────────────

  /**
   * A teacher may only touch classes they are assigned to.
   *
   * Class ownership is the rule rather than who created the record, so a class
   * handed to a new teacher mid-year stays manageable. Without this check any
   * teacher could post marks against any class by changing the id in the
   * request, and the supervisors' notification would name the wrong person.
   */
  private async assertTeacherOwnsClass(classId: number, user: User) {
    const cls = await this.classRepo.findOne({ where: { id: classId } });
    if (!cls) throw new NotFoundException('Class not found');

    if (cls.teacher_id !== user.id) {
      throw new ForbiddenException('You are not assigned to this class');
    }
    return cls;
  }

  /** Loads an assessment and confirms the caller is allowed to modify it. */
  private async loadForTeacher(id: number, user: User) {
    const assessment = await this.assessmentRepo.findOne({ where: { id } });
    if (!assessment) throw new NotFoundException('Assessment not found');

    await this.assertTeacherOwnsClass(assessment.class_id, user);
    return assessment;
  }

  private assertEditable(assessment: Assessment) {
    if (assessment.status !== 'draft') {
      throw new BadRequestException(
        'This assessment has been submitted. Reopen it before making changes.',
      );
    }
  }

  // ─── Teacher: creating and editing ───────────────────────────────────────────

  async createAssessment(dto: CreateAssessmentDto, user: User) {
    const cls = await this.assertTeacherOwnsClass(dto.class_id, user);

    const subject = await this.subjectRepo.findOne({ where: { id: dto.subject_id } });
    if (!subject) throw new NotFoundException('Subject not found');
    if (subject.p_level_id !== cls.p_level_id) {
      throw new BadRequestException('That subject is not taught at this class\'s level');
    }

    const term = await this.termRepo.findOne({ where: { id: dto.term_id } });
    if (!term) throw new NotFoundException('Term not found');
    if (term.status === 'closed') {
      throw new BadRequestException('That term is closed — its marks are final');
    }

    const type = await this.typeRepo.findOne({ where: { id: dto.assessment_type_id } });
    if (!type) throw new NotFoundException('Assessment type not found');
    if (type.academic_year_id !== term.academic_year_id) {
      throw new BadRequestException('That assessment type belongs to a different academic year');
    }

    return this.assessmentRepo.save(
      this.assessmentRepo.create({ ...dto, created_by: user.id, status: 'draft' }),
    );
  }

  async updateAssessment(id: number, dto: UpdateAssessmentDto, user: User) {
    const assessment = await this.loadForTeacher(id, user);
    this.assertEditable(assessment);

    Object.assign(assessment, dto);
    return this.assessmentRepo.save(assessment);
  }

  async deleteAssessment(id: number, user: User) {
    const assessment = await this.loadForTeacher(id, user);
    this.assertEditable(assessment);

    await this.assessmentRepo.remove(assessment);
    return { message: 'Draft assessment deleted' };
  }

  /**
   * Save marks. Entries for students outside the class are rejected rather
   * than silently dropped, so a stale roster on the client surfaces as an
   * error instead of quietly losing a child's mark.
   */
  async saveScores(id: number, dto: SaveScoresDto, user: User) {
    const assessment = await this.loadForTeacher(id, user);
    this.assertEditable(assessment);

    const roster = await this.studentRepo.find({
      where: { current_class_id: assessment.class_id },
    });
    const rosterIds = new Set(roster.map((s) => s.id));

    for (const entry of dto.scores) {
      if (!rosterIds.has(entry.student_id)) {
        throw new BadRequestException(`Student ${entry.student_id} is not in this class`);
      }
      if (entry.score != null && entry.score > assessment.max_score) {
        throw new BadRequestException(
          `A score of ${entry.score} exceeds this assessment's maximum of ${assessment.max_score}`,
        );
      }
    }

    for (const entry of dto.scores) {
      const isAbsent = entry.is_absent ?? false;
      // An absence has no mark by definition; storing both would let them disagree.
      const score = isAbsent ? null : entry.score ?? null;

      const existing = await this.scoreRepo.findOne({
        where: { assessment_id: id, student_id: entry.student_id },
      });

      if (existing) {
        existing.score = score;
        existing.is_absent = isAbsent;
        await this.scoreRepo.save(existing);
      } else {
        await this.scoreRepo.save(
          this.scoreRepo.create({
            assessment_id: id,
            student_id: entry.student_id,
            score,
            is_absent: isAbsent,
          }),
        );
      }
    }

    return this.getAssessment(id, user);
  }

  // ─── Teacher: submitting ─────────────────────────────────────────────────────

  async submitAssessment(id: number, user: User) {
    const assessment = await this.loadForTeacher(id, user);
    this.assertEditable(assessment);

    const recorded = await this.scoreRepo.count({ where: { assessment_id: id } });
    if (!recorded) {
      throw new BadRequestException('Record at least one mark before submitting');
    }

    assessment.status = 'submitted';
    assessment.submitted_at = new Date();
    await this.assessmentRepo.save(assessment);

    await this.notifySupervisors(assessment, user, 'submitted');
    return this.getAssessment(id, user);
  }

  /**
   * Return a submitted assessment to draft so a mistake can be corrected.
   *
   * Mirrors the attendance reset: corrections stay possible, but supervisors
   * are told, so marks never change quietly behind an approval.
   */
  async reopenAssessment(id: number, user: User) {
    const assessment = await this.loadForTeacher(id, user);
    if (assessment.status !== 'submitted') {
      throw new BadRequestException('Only a submitted assessment can be reopened');
    }

    assessment.status = 'draft';
    assessment.submitted_at = null;
    await this.assessmentRepo.save(assessment);

    await this.notifySupervisors(assessment, user, 'reopened');
    return this.getAssessment(id, user);
  }

  private async notifySupervisors(
    assessment: Assessment,
    teacher: User,
    action: 'submitted' | 'reopened',
  ) {
    const context = await this.assessmentRepo.query(
      `SELECT pl.name AS p_level_name, c.name AS class_name, s.name AS subject_name, t.name AS term_name
       FROM assessments a
       JOIN classes c   ON c.id = a.class_id
       JOIN p_levels pl ON pl.id = c.p_level_id
       JOIN subjects s  ON s.id = a.subject_id
       JOIN terms t     ON t.id = a.term_id
       WHERE a.id = $1`,
      [assessment.id],
    );

    const row = context[0];
    const classLabel = row ? `${row.p_level_name}${row.class_name}` : 'a class';
    const subject = row?.subject_name ?? 'a subject';
    const term = row?.term_name ?? 'the current term';

    const message =
      action === 'submitted'
        ? `${teacher.name} submitted ${subject} marks for ${classLabel} — "${assessment.title}" (${term}).`
        : `${teacher.name} reopened ${subject} marks for ${classLabel} — "${assessment.title}" (${term}) to correct them.`;

    // Best-effort: the marks are already saved and valid. A failure to notify
    // must not surface as a failed submission, or a teacher would re-enter
    // marks that were in fact recorded. It is logged loudly instead.
    try {
      await this.notificationsService.notifyRoles(
        ['dean', 'principal'],
        message,
        action === 'submitted' ? 'info' : 'warning',
        `/assessments/${assessment.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Assessment ${assessment.id} was ${action} but supervisors could not be notified`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // ─── Reading ─────────────────────────────────────────────────────────────────

  async listMyAssessments(user: User) {
    return this.assessmentRepo.query(
      `SELECT a.id, a.title, a.date::text AS date, a.max_score, a.status, a.submitted_at,
              c.name AS class_name, pl.name AS p_level_name,
              s.name AS subject_name, ty.name AS type_name, t.name AS term_name,
              (SELECT COUNT(*) FROM assessment_scores sc WHERE sc.assessment_id = a.id) AS recorded,
              (SELECT COUNT(*) FROM students st WHERE st.current_class_id = a.class_id) AS roster_size
       FROM assessments a
       JOIN classes c   ON c.id = a.class_id
       JOIN p_levels pl ON pl.id = c.p_level_id
       JOIN subjects s  ON s.id = a.subject_id
       JOIN assessment_types ty ON ty.id = a.assessment_type_id
       JOIN terms t     ON t.id = a.term_id
       WHERE c.teacher_id = $1
       ORDER BY a.date DESC, a.id DESC`,
      [user.id],
    );
  }

  /** Submitted assessments, for the dean's and principal's oversight list. */
  async listForSupervisors(filters: { class_id?: number; term_id?: number; subject_id?: number }) {
    return this.assessmentRepo.query(
      `SELECT a.id, a.title, a.date::text AS date, a.max_score, a.submitted_at,
              c.name AS class_name, pl.name AS p_level_name,
              s.name AS subject_name, ty.name AS type_name, t.name AS term_name,
              u.name AS teacher_name,
              (SELECT COUNT(*) FROM assessment_scores sc WHERE sc.assessment_id = a.id) AS recorded,
              (SELECT COUNT(*) FROM students st WHERE st.current_class_id = a.class_id) AS roster_size
       FROM assessments a
       JOIN classes c   ON c.id = a.class_id
       JOIN p_levels pl ON pl.id = c.p_level_id
       JOIN subjects s  ON s.id = a.subject_id
       JOIN assessment_types ty ON ty.id = a.assessment_type_id
       JOIN terms t     ON t.id = a.term_id
       LEFT JOIN users u ON u.id = c.teacher_id
       WHERE a.status = 'submitted'
         AND ($1::int IS NULL OR a.class_id = $1)
         AND ($2::int IS NULL OR a.term_id = $2)
         AND ($3::int IS NULL OR a.subject_id = $3)
       ORDER BY a.submitted_at DESC`,
      [filters.class_id ?? null, filters.term_id ?? null, filters.subject_id ?? null],
    );
  }

  /**
   * One assessment with its roster, marks and the summary cards.
   *
   * Teachers see only their own classes; supervisors see any submitted
   * assessment but never a draft, which is the teacher's working copy.
   */
  async getAssessment(id: number, user: User) {
    const assessment = await this.assessmentRepo.findOne({ where: { id } });
    if (!assessment) throw new NotFoundException('Assessment not found');

    const isSupervisor = SUPERVISOR_ROLES.includes(user.role);
    if (isSupervisor) {
      if (assessment.status !== 'submitted') {
        throw new ForbiddenException('This assessment has not been submitted yet');
      }
    } else {
      await this.assertTeacherOwnsClass(assessment.class_id, user);
    }

    const meta = await this.assessmentRepo.query(
      `SELECT c.name AS class_name, pl.name AS p_level_name,
              s.name AS subject_name, ty.name AS type_name, ty.weight AS type_weight,
              t.name AS term_name, u.name AS teacher_name
       FROM assessments a
       JOIN classes c   ON c.id = a.class_id
       JOIN p_levels pl ON pl.id = c.p_level_id
       JOIN subjects s  ON s.id = a.subject_id
       JOIN assessment_types ty ON ty.id = a.assessment_type_id
       JOIN terms t     ON t.id = a.term_id
       LEFT JOIN users u ON u.id = c.teacher_id
       WHERE a.id = $1`,
      [id],
    );

    // Left join so every enrolled child appears, including those with no mark
    // yet — an unmarked student must be visible to be marked.
    const rows = await this.studentRepo.query(
      `SELECT st.id AS student_id, st.name AS student_name,
              sc.score, sc.is_absent
       FROM students st
       LEFT JOIN assessment_scores sc
         ON sc.student_id = st.id AND sc.assessment_id = $1
       WHERE st.current_class_id = $2
       ORDER BY st.name ASC`,
      [id, assessment.class_id],
    );

    const students = rows.map((r: any) => ({
      student_id: r.student_id,
      student_name: r.student_name,
      score: r.score === null ? null : Number(r.score),
      is_absent: r.is_absent ?? false,
      percentage:
        r.score === null || assessment.max_score <= 0
          ? null
          : Math.round((Number(r.score) / assessment.max_score) * 10000) / 100,
    }));

    return {
      ...assessment,
      ...(meta[0] ?? {}),
      class_label: meta[0] ? `${meta[0].p_level_name}${meta[0].class_name}` : null,
      students,
      analytics: summariseAssessment(students, assessment.max_score, students.length),
    };
  }
}
