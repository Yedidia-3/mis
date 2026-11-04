import {
  BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Assessment } from '../../entities/assessment.entity';
import { AssessmentScore } from '../../entities/assessment-score.entity';
import { ASSESSMENT_CATEGORIES, AssessmentCategory, AssessmentType } from '../../entities/assessment-type.entity';
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
  CreateCatalogueEntryDto, UpdateCatalogueEntryDto, AssignPLevelDto, CloseTermDto,
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

  /**
   * The dean's term control page: the active year's terms with how many
   * assessments each holds, so closing a term never surprises anyone.
   */
  async termsOverview(academicYearId?: number) {
    const year = academicYearId
      ? (await this.classRepo.query(`SELECT id, name, status FROM academic_years WHERE id = $1`, [academicYearId]))[0]
      : await this.activeYear();
    if (!year) return { academic_year: null, current_term_id: null, terms: [] };

    const terms = await this.termRepo.find({ where: { academic_year_id: year.id }, order: { sequence: 'ASC' } });
    const counts: { term_id: number; drafts: string; submitted: string }[] = await this.assessmentRepo.query(
      `SELECT term_id,
              COUNT(*) FILTER (WHERE status = 'draft')     AS drafts,
              COUNT(*) FILTER (WHERE status = 'submitted') AS submitted
       FROM assessments WHERE term_id = ANY($1) GROUP BY term_id`,
      [terms.map((t) => t.id)],
    );
    const byTerm = new Map(counts.map((c) => [c.term_id, c]));
    const current = terms.find((t) => t.status === 'active') ?? null;

    return {
      academic_year: { id: year.id, name: year.name },
      current_term_id: current?.id ?? null,
      terms: terms.map((t) => ({
        id: t.id, name: t.name, sequence: t.sequence,
        start_date: t.start_date, end_date: t.end_date, status: t.status,
        drafts: Number(byTerm.get(t.id)?.drafts ?? 0),
        submitted: Number(byTerm.get(t.id)?.submitted ?? 0),
      })),
    };
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
    await this.assertNoOverlap(dto.academic_year_id, dto.start_date, dto.end_date);
    return this.termRepo.save(this.termRepo.create({ ...dto, status: 'upcoming' }));
  }

  async updateTerm(id: number, dto: UpdateTermDto) {
    const term = await this.termRepo.findOne({ where: { id } });
    if (!term) throw new NotFoundException('Term not found');
    if (term.status === 'closed') {
      throw new BadRequestException(`${term.name} is closed. Reopen it before changing its name or dates.`);
    }

    const start = dto.start_date ?? term.start_date;
    const end = dto.end_date ?? term.end_date;
    if (end < start) {
      throw new BadRequestException('Term end date cannot precede its start date');
    }
    await this.assertNoOverlap(term.academic_year_id, start, end, term.id);

    // Shrinking a term must not strand marks already dated inside it.
    const outside: { n: string }[] = await this.assessmentRepo.query(
      `SELECT COUNT(*) AS n FROM assessments WHERE term_id = $1 AND (date < $2 OR date > $3)`,
      [term.id, start, end],
    );
    if (Number(outside[0]?.n ?? 0) > 0) {
      throw new BadRequestException(
        `${outside[0].n} assessment(s) in ${term.name} are dated outside ${start} to ${end}. Keep the dates wide enough to include them.`,
      );
    }

    if (dto.name !== undefined) term.name = dto.name;
    term.start_date = start;
    term.end_date = end;
    return this.termRepo.save(term);
  }

  /**
   * Make a term the current one. Only one term per year is open at a time,
   * so teachers always record into the term the dean chose.
   */
  async openTerm(id: number) {
    const term = await this.termRepo.findOne({ where: { id } });
    if (!term) throw new NotFoundException('Term not found');
    if (term.status === 'active') throw new BadRequestException(`${term.name} is already open`);

    const year = await this.classRepo.query(`SELECT status FROM academic_years WHERE id = $1`, [term.academic_year_id]);
    if (year[0]?.status !== 'active') {
      throw new BadRequestException('Terms can only be opened in the active academic year');
    }

    const other = await this.termRepo.findOne({ where: { academic_year_id: term.academic_year_id, status: 'active' } });
    if (other) {
      throw new ConflictException(`${other.name} is still open. Close it before opening ${term.name}.`);
    }

    const reopening = term.status === 'closed';
    term.status = 'active';
    const saved = await this.termRepo.save(term);

    await this.announceTerm(
      reopening
        ? `${term.name} has been reopened. Marks for it can be changed again until it is closed.`
        : `${term.name} is now open. New marks are recorded in ${term.name}.`,
      reopening ? 'warning' : 'info',
    );
    return saved;
  }

  /** Finalise a term's marks. Unsubmitted drafts must be acknowledged, since they will not reach a report. */
  async closeTerm(id: number, dto: CloseTermDto) {
    const term = await this.termRepo.findOne({ where: { id } });
    if (!term) throw new NotFoundException('Term not found');
    if (term.status !== 'active') throw new BadRequestException(`${term.name} is not open`);

    const drafts: { n: string }[] = await this.assessmentRepo.query(
      `SELECT COUNT(*) AS n FROM assessments WHERE term_id = $1 AND status = 'draft'`,
      [term.id],
    );
    const draftCount = Number(drafts[0]?.n ?? 0);
    if (draftCount > 0 && !dto.confirm_drafts) {
      throw new ConflictException(
        `${draftCount} assessment(s) in ${term.name} are still drafts and will not appear on reports. Confirm to close anyway.`,
      );
    }

    term.status = 'closed';
    const saved = await this.termRepo.save(term);

    await this.announceTerm(`${term.name} has been closed. Its marks are now final.`, 'info');
    return saved;
  }

  /** Each role's link goes to a page that role can open. */
  private async announceTerm(message: string, type: 'info' | 'warning') {
    await Promise.all([
      this.notificationsService.notifyRoles(['dean'], message, type, '/dean/terms'),
      this.notificationsService.notifyRoles(['teacher'], message, type, '/teacher/marks'),
      this.notificationsService.notifyRoles(['principal'], message, type),
    ]);
  }

  private async assertNoOverlap(yearId: number, start: string, end: string, exceptId?: number) {
    const clash: { name: string }[] = await this.termRepo.query(
      `SELECT name FROM terms
       WHERE academic_year_id = $1 AND id <> $2 AND start_date <= $4 AND end_date >= $3
       LIMIT 1`,
      [yearId, exceptId ?? 0, start, end],
    );
    if (clash.length) {
      throw new BadRequestException(`These dates overlap ${clash[0].name}`);
    }
  }

  // ─── Dean configuration: subjects ────────────────────────────────────────────

  async listSubjects(pLevelId: number) {
    return this.subjectRepo.find({
      where: { p_level_id: pLevelId, status: 'active' },
      order: { display_order: 'ASC', name: 'ASC' },
    });
  }

  async createSubject(dto: CreateSubjectDto) {
    const pl = await this.classRepo.query(`SELECT id FROM p_levels WHERE id = $1 AND status = 'active'`, [dto.p_level_id]);
    if (!pl.length) throw new NotFoundException('P-Level not found');
    const code = dto.code.trim().toUpperCase();
    const name = dto.name.replace(/\s+/g, ' ').trim();
    const clash = await this.subjectRepo.findOne({
      where: { p_level_id: dto.p_level_id, code },
    });
    if (clash) {
      throw new BadRequestException(`Subject code ${code} already exists at this level`);
    }
    // Periods stay on the row for timetable/report math, but the Courses UI
    // no longer asks for them — default until the dean brings credits back.
    return this.subjectRepo.save(this.subjectRepo.create({
      p_level_id: dto.p_level_id,
      name,
      code,
      display_order: dto.display_order ?? 0,
      periods_per_week: 5,
      min_consecutive: 1,
    }));
  }

  async updateSubject(id: number, dto: UpdateSubjectDto) {
    const subject = await this.subjectRepo.findOne({ where: { id } });
    if (!subject) throw new NotFoundException('Subject not found');
    if (dto.name !== undefined) subject.name = dto.name.replace(/\s+/g, ' ').trim();
    if (dto.code !== undefined) {
      const code = dto.code.trim().toUpperCase();
      const clash = await this.subjectRepo.findOne({ where: { p_level_id: subject.p_level_id, code } });
      if (clash && clash.id !== id) {
        throw new BadRequestException(`Subject code ${code} already exists at this level`);
      }
      subject.code = code;
    }
    if (dto.display_order !== undefined) subject.display_order = dto.display_order;
    // Ignore periods_per_week / min_consecutive from clients while credits are paused.
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

  // ─── Categories (quiz / homework / exam) ─────────────────────────────────────

  private static readonly CATEGORY_DEFAULTS: { category: AssessmentCategory; name: string; weight: number; order: number }[] = [
    { category: 'quiz', name: 'Quiz', weight: 25, order: 1 },
    { category: 'homework', name: 'Homework', weight: 25, order: 2 },
    { category: 'exam', name: 'Exam', weight: 50, order: 3 },
  ];

  /**
   * The year's assessment type for each category, created on first use so the
   * dean never has to configure them before teachers can record marks. A type
   * already named Quiz, Homework or Exam is adopted rather than duplicated.
   */
  async ensureCategoryTypes(academicYearId: number): Promise<Map<AssessmentCategory, AssessmentType>> {
    const existing = await this.typeRepo.find({ where: { academic_year_id: academicYearId } });
    const byCategory = new Map<AssessmentCategory, AssessmentType>();

    for (const def of AssessmentsService.CATEGORY_DEFAULTS) {
      let type = existing.find((t) => t.category === def.category)
        ?? existing.find((t) => !t.category && t.name.trim().toLowerCase() === def.name.toLowerCase());
      if (!type) {
        type = this.typeRepo.create({
          academic_year_id: academicYearId,
          name: def.name,
          weight: def.weight,
          display_order: def.order,
          category: def.category,
          status: 'active',
        });
      } else if (type.category !== def.category || type.status !== 'active') {
        type.category = def.category;
        type.status = 'active';
      } else {
        byCategory.set(def.category, type);
        continue;
      }
      byCategory.set(def.category, await this.typeRepo.save(type));
    }
    return byCategory;
  }

  // ─── Access control ──────────────────────────────────────────────────────────

  /**
   * A teacher may record a subject in a class when they are its class teacher,
   * or when the dean assigned them that subject there.
   *
   * Checked on every write, so changing an id in the request cannot post marks
   * against someone else's class or subject.
   */
  private async assertTeacherMayRecord(classId: number, subjectId: number, user: User) {
    const cls = await this.classRepo.findOne({ where: { id: classId } });
    if (!cls) throw new NotFoundException('Class not found');
    if (cls.status !== 'active' || !cls.distributed_at) {
      throw new ForbiddenException('This class is not open for marks yet');
    }
    if (cls.teacher_id === user.id) return cls;

    const assigned = await this.classRepo.query(
      `SELECT 1 FROM teaching_assignments WHERE teacher_id = $1 AND class_id = $2 AND subject_id = $3 LIMIT 1`,
      [user.id, classId, subjectId],
    );
    if (!assigned.length) {
      throw new ForbiddenException('You do not teach this subject in this class');
    }
    return cls;
  }

  /** Loads an assessment and confirms the caller is allowed to modify it. */
  private async loadForTeacher(id: number, user: User) {
    const assessment = await this.assessmentRepo.findOne({ where: { id } });
    if (!assessment) throw new NotFoundException('Assessment not found');

    await this.assertTeacherMayRecord(assessment.class_id, assessment.subject_id, user);
    return assessment;
  }

  private assertEditable(assessment: Assessment) {
    if (assessment.status !== 'draft') {
      throw new BadRequestException(
        'This assessment has been submitted. Reopen it before making changes.',
      );
    }
  }

  /** Marks are written only into the term the dean has opened. */
  private async assertTermOpen(termId: number) {
    const term = await this.termRepo.findOne({ where: { id: termId } });
    if (!term) throw new NotFoundException('Term not found');
    if (term.status === 'closed') {
      throw new BadRequestException(`${term.name} is closed — its marks are final`);
    }
    if (term.status !== 'active') {
      throw new BadRequestException(`${term.name} has not been opened yet. Marks go into the current term.`);
    }
    return term;
  }

  private assertDateInTerm(date: string, term: Term) {
    if (date < term.start_date || date > term.end_date) {
      throw new BadRequestException(
        `The date must fall inside ${term.name} (${term.start_date} to ${term.end_date})`,
      );
    }
    const today = new Date().toISOString().slice(0, 10);
    if (date > today) {
      throw new BadRequestException('The assessment date cannot be in the future');
    }
  }

  /** Students whose marks belong on this class's sheet. */
  private async rosterFor(classId: number): Promise<{ id: number; name: string }[]> {
    return this.studentRepo.query(
      `SELECT id, name FROM students
       WHERE current_class_id = $1 AND status::text <> 'transferred'
       ORDER BY name ASC`,
      [classId],
    );
  }

  // ─── Teacher: what they may record ───────────────────────────────────────────

  /**
   * Everything the "new assessment" form needs in one call: the teacher's
   * classes in the active year, the subjects they may record in each, that
   * year's terms and the three categories.
   */
  async getRecordingOptions(user: User) {
    const year = await this.activeYear();
    if (!year) {
      return { academic_year: null, current_term_id: null, classes: [], terms: [], categories: ASSESSMENT_CATEGORIES };
    }

    const classes: any[] = await this.classRepo.query(
      `SELECT DISTINCT c.id, c.name, c.teacher_id, pl.id AS p_level_id, pl.name AS p_level_name
       FROM classes c
       JOIN p_levels pl ON pl.id = c.p_level_id
       LEFT JOIN teaching_assignments ta ON ta.class_id = c.id AND ta.teacher_id = $1
       WHERE pl.academic_year_id = $2
         AND c.status = 'active' AND c.distributed_at IS NOT NULL
         AND (c.teacher_id = $1 OR ta.id IS NOT NULL)
       ORDER BY pl.name ASC, c.name ASC`,
      [user.id, year.id],
    );

    const result = [];
    for (const c of classes) {
      const isClassTeacher = c.teacher_id === user.id;
      const subjects = isClassTeacher
        ? await this.classRepo.query(
            `SELECT id, name, code FROM subjects
             WHERE p_level_id = $1 AND status = 'active'
             ORDER BY display_order ASC, name ASC`,
            [c.p_level_id],
          )
        : await this.classRepo.query(
            `SELECT s.id, s.name, s.code FROM teaching_assignments ta
             JOIN subjects s ON s.id = ta.subject_id
             WHERE ta.teacher_id = $1 AND ta.class_id = $2 AND s.status = 'active'
             ORDER BY s.display_order ASC, s.name ASC`,
            [user.id, c.id],
          );
      const roster = await this.rosterFor(c.id);
      result.push({
        id: c.id,
        label: `${c.p_level_name}${c.name}`,
        p_level_id: c.p_level_id,
        p_level_name: c.p_level_name,
        role: isClassTeacher ? 'class_teacher' : 'teacher',
        student_count: roster.length,
        subjects,
      });
    }

    const terms = await this.termRepo.find({
      where: { academic_year_id: year.id },
      order: { sequence: 'ASC' },
    });

    return {
      academic_year: { id: year.id, name: year.name },
      current_term_id: terms.find((t) => t.status === 'active')?.id ?? null,
      classes: result,
      terms: terms.map((t) => ({
        id: t.id, name: t.name, sequence: t.sequence,
        start_date: t.start_date, end_date: t.end_date, status: t.status,
      })),
      categories: ASSESSMENT_CATEGORIES,
    };
  }

  private async activeYear(): Promise<{ id: number; name: string } | null> {
    const rows = await this.classRepo.query(
      `SELECT id, name FROM academic_years WHERE status = 'active' ORDER BY id DESC LIMIT 1`,
    );
    return rows[0] ?? null;
  }

  // ─── Teacher: creating and editing ───────────────────────────────────────────

  async createAssessment(dto: CreateAssessmentDto, user: User) {
    const cls = await this.assertTeacherMayRecord(dto.class_id, dto.subject_id, user);

    const subject = await this.subjectRepo.findOne({ where: { id: dto.subject_id } });
    if (!subject || subject.status !== 'active') throw new NotFoundException('Subject not found');
    if (subject.p_level_id !== cls.p_level_id) {
      throw new BadRequestException('That subject is not taught at this class\'s level');
    }

    const term = await this.assertTermOpen(dto.term_id);
    const levelYear = await this.classRepo.query(
      `SELECT academic_year_id FROM p_levels WHERE id = $1`,
      [cls.p_level_id],
    );
    if (levelYear[0]?.academic_year_id !== term.academic_year_id) {
      throw new BadRequestException('That term belongs to a different academic year');
    }
    this.assertDateInTerm(dto.date, term);

    const types = await this.ensureCategoryTypes(term.academic_year_id);
    const type = types.get(dto.category);
    if (!type) throw new BadRequestException('Unknown assessment category');

    const duplicate = await this.assessmentRepo.query(
      `SELECT 1 FROM assessments
       WHERE class_id = $1 AND subject_id = $2 AND term_id = $3 AND lower(title) = lower($4)
       LIMIT 1`,
      [dto.class_id, dto.subject_id, dto.term_id, dto.title],
    );
    if (duplicate.length) {
      throw new BadRequestException('An assessment with this title already exists for this subject and term');
    }

    return this.assessmentRepo.save(
      this.assessmentRepo.create({
        class_id: dto.class_id,
        subject_id: dto.subject_id,
        term_id: dto.term_id,
        assessment_type_id: type.id,
        title: dto.title,
        date: dto.date,
        max_score: dto.max_score,
        created_by: user.id,
        status: 'draft',
      }),
    );
  }

  async updateAssessment(id: number, dto: UpdateAssessmentDto, user: User) {
    const assessment = await this.loadForTeacher(id, user);
    this.assertEditable(assessment);
    const term = await this.assertTermOpen(assessment.term_id);

    if (dto.date !== undefined) {
      this.assertDateInTerm(dto.date, term);
      assessment.date = dto.date;
    }
    if (dto.title !== undefined) {
      const duplicate = await this.assessmentRepo.query(
        `SELECT 1 FROM assessments
         WHERE class_id = $1 AND subject_id = $2 AND term_id = $3 AND lower(title) = lower($4) AND id <> $5
         LIMIT 1`,
        [assessment.class_id, assessment.subject_id, assessment.term_id, dto.title, id],
      );
      if (duplicate.length) {
        throw new BadRequestException('An assessment with this title already exists for this subject and term');
      }
      assessment.title = dto.title;
    }
    if (dto.category !== undefined) {
      const types = await this.ensureCategoryTypes(term.academic_year_id);
      const type = types.get(dto.category);
      if (!type) throw new BadRequestException('Unknown assessment category');
      assessment.assessment_type_id = type.id;
    }
    if (dto.max_score !== undefined) {
      const highest = await this.scoreRepo.query(
        `SELECT MAX(score) AS top FROM assessment_scores WHERE assessment_id = $1`,
        [id],
      );
      const top = highest[0]?.top == null ? null : Number(highest[0].top);
      if (top !== null && top > dto.max_score) {
        throw new BadRequestException(
          `A recorded mark of ${top} is above ${dto.max_score}. Correct that mark first.`,
        );
      }
      assessment.max_score = dto.max_score;
    }

    await this.assessmentRepo.save(assessment);
    return this.getAssessment(id, user);
  }

  async deleteAssessment(id: number, user: User) {
    const assessment = await this.loadForTeacher(id, user);
    this.assertEditable(assessment);
    await this.assertTermOpen(assessment.term_id);

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
    await this.assertTermOpen(assessment.term_id);

    const roster = await this.rosterFor(assessment.class_id);
    const rosterIds = new Set(roster.map((s) => s.id));
    const seen = new Set<number>();

    for (const entry of dto.scores) {
      if (seen.has(entry.student_id)) {
        throw new BadRequestException(`Student ${entry.student_id} appears more than once`);
      }
      seen.add(entry.student_id);
      if (!rosterIds.has(entry.student_id)) {
        throw new BadRequestException(`Student ${entry.student_id} is not in this class`);
      }
      if (entry.is_absent && entry.score != null) {
        throw new BadRequestException('A student marked absent cannot also have a score');
      }
      if (entry.score != null && entry.score > assessment.max_score) {
        throw new BadRequestException(
          `A score of ${entry.score} exceeds this assessment's maximum of ${assessment.max_score}`,
        );
      }
    }

    await this.scoreRepo.manager.transaction(async (manager) => {
      for (const entry of dto.scores) {
        const isAbsent = entry.is_absent ?? false;
        const score = isAbsent ? null : entry.score ?? null;

        if (!isAbsent && score === null) {
          await manager.delete(AssessmentScore, { assessment_id: id, student_id: entry.student_id });
          continue;
        }

        const existing = await manager.findOne(AssessmentScore, {
          where: { assessment_id: id, student_id: entry.student_id },
        });
        if (existing) {
          existing.score = score;
          existing.is_absent = isAbsent;
          await manager.save(existing);
        } else {
          await manager.save(manager.create(AssessmentScore, {
            assessment_id: id,
            student_id: entry.student_id,
            score,
            is_absent: isAbsent,
          }));
        }
      }
    });

    return this.getAssessment(id, user);
  }

  // ─── Teacher: submitting ─────────────────────────────────────────────────────

  /** Every child on the roster must have a mark or be marked absent. */
  async submitAssessment(id: number, user: User) {
    const assessment = await this.loadForTeacher(id, user);
    this.assertEditable(assessment);
    await this.assertTermOpen(assessment.term_id);

    const roster = await this.rosterFor(assessment.class_id);
    if (!roster.length) throw new BadRequestException('This class has no students to mark');

    const recorded: { student_id: number }[] = await this.scoreRepo.query(
      `SELECT student_id FROM assessment_scores
       WHERE assessment_id = $1 AND (score IS NOT NULL OR is_absent)`,
      [id],
    );
    const done = new Set(recorded.map((r) => r.student_id));
    const missing = roster.filter((s) => !done.has(s.id));
    if (missing.length) {
      const names = missing.slice(0, 5).map((s) => s.name).join(', ');
      throw new BadRequestException(
        `${missing.length} student${missing.length === 1 ? ' has' : 's have'} no mark yet (${names}${missing.length > 5 ? ', …' : ''}). Enter a mark or tick Absent for each.`,
      );
    }

    assessment.status = 'submitted';
    assessment.submitted_at = new Date();
    await this.assessmentRepo.save(assessment);

    await this.notifySupervisors(assessment, user, 'submitted');
    return this.getAssessment(id, user);
  }

  /**
   * Return a submitted assessment to draft so a mistake can be corrected.
   * The dean is told, so marks never change quietly after submission.
   */
  async reopenAssessment(id: number, user: User) {
    const assessment = await this.loadForTeacher(id, user);
    if (assessment.status !== 'submitted') {
      throw new BadRequestException('Only a submitted assessment can be reopened');
    }
    await this.assertTermOpen(assessment.term_id);

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
    // The JWT user carries only id, email and role.
    const named = await this.assessmentRepo.query(`SELECT name FROM users WHERE id = $1`, [teacher.id]);
    const teacherName = named[0]?.name ?? teacher.email ?? 'A teacher';

    const message =
      action === 'submitted'
        ? `${teacherName} submitted ${subject} marks for ${classLabel} — "${assessment.title}" (${term}).`
        : `${teacherName} reopened ${subject} marks for ${classLabel} — "${assessment.title}" (${term}) to correct them.`;

    // Best-effort: the marks are already saved and valid. A failure to notify
    // must not surface as a failed submission, or a teacher would re-enter
    // marks that were in fact recorded.
    try {
      await this.notificationsService.notifyRoles(
        ['dean'],
        message,
        action === 'submitted' ? 'info' : 'warning',
        `/dean/academic-records/assessments/${assessment.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Assessment ${assessment.id} was ${action} but the dean could not be notified`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // ─── Reading ─────────────────────────────────────────────────────────────────

  async listMyAssessments(user: User) {
    const rows = await this.assessmentRepo.query(
      `SELECT a.id, a.title, a.date::text AS date, a.max_score, a.status, a.submitted_at,
              a.class_id, a.subject_id, a.term_id,
              c.name AS class_name, pl.name AS p_level_name,
              s.name AS subject_name, ty.name AS type_name, ty.category, t.name AS term_name,
              t.status AS term_status,
              (SELECT COUNT(*)::int FROM assessment_scores sc
                 WHERE sc.assessment_id = a.id AND (sc.score IS NOT NULL OR sc.is_absent)) AS recorded,
              (SELECT COUNT(*)::int FROM students st
                 WHERE st.current_class_id = a.class_id AND st.status::text <> 'transferred') AS roster_size
       FROM assessments a
       JOIN classes c   ON c.id = a.class_id
       JOIN p_levels pl ON pl.id = c.p_level_id
       JOIN subjects s  ON s.id = a.subject_id
       JOIN assessment_types ty ON ty.id = a.assessment_type_id
       JOIN terms t     ON t.id = a.term_id
       WHERE c.teacher_id = $1
          OR EXISTS (SELECT 1 FROM teaching_assignments ta
                     WHERE ta.teacher_id = $1 AND ta.class_id = a.class_id AND ta.subject_id = a.subject_id)
       ORDER BY a.date DESC, a.id DESC`,
      [user.id],
    );
    return rows.map((r: any) => ({ ...r, max_score: Number(r.max_score), class_label: `${r.p_level_name}${r.class_name}` }));
  }

  /** Submitted assessments, for the dean's and principal's oversight list. */
  async listForSupervisors(filters: { class_id?: number; term_id?: number; subject_id?: number }) {
    return this.assessmentRepo.query(
      `SELECT a.id, a.title, a.date::text AS date, a.max_score, a.submitted_at,
              c.name AS class_name, pl.name AS p_level_name,
              s.name AS subject_name, ty.name AS type_name, ty.category, t.name AS term_name,
              u.name AS teacher_name,
              (SELECT COUNT(*) FROM assessment_scores sc WHERE sc.assessment_id = a.id) AS recorded,
              (SELECT COUNT(*) FROM students st WHERE st.current_class_id = a.class_id) AS roster_size
       FROM assessments a
       JOIN classes c   ON c.id = a.class_id
       JOIN p_levels pl ON pl.id = c.p_level_id
       JOIN subjects s  ON s.id = a.subject_id
       JOIN assessment_types ty ON ty.id = a.assessment_type_id
       JOIN terms t     ON t.id = a.term_id
       LEFT JOIN users u ON u.id = a.created_by
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
   * Teachers see only what they may record; supervisors see any submitted
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
      await this.assertTeacherMayRecord(assessment.class_id, assessment.subject_id, user);
    }

    const meta = await this.assessmentRepo.query(
      `SELECT c.name AS class_name, pl.name AS p_level_name,
              s.name AS subject_name, ty.name AS type_name, ty.category, ty.weight AS type_weight,
              t.name AS term_name, t.status AS term_status, t.start_date::text AS term_start,
              t.end_date::text AS term_end, u.name AS teacher_name, u.avatar AS teacher_avatar
       FROM assessments a
       JOIN classes c   ON c.id = a.class_id
       JOIN p_levels pl ON pl.id = c.p_level_id
       JOIN subjects s  ON s.id = a.subject_id
       JOIN assessment_types ty ON ty.id = a.assessment_type_id
       JOIN terms t     ON t.id = a.term_id
       LEFT JOIN users u ON u.id = a.created_by
       WHERE a.id = $1`,
      [id],
    );

    // Every enrolled child appears, including those with no mark yet — an
    // unmarked student must be visible to be marked.
    const rows = await this.studentRepo.query(
      `SELECT st.id AS student_id, st.name AS student_name, st.student_id_number,
              sc.score, sc.is_absent
       FROM students st
       LEFT JOIN assessment_scores sc
         ON sc.student_id = st.id AND sc.assessment_id = $1
       WHERE st.current_class_id = $2 AND st.status::text <> 'transferred'
       ORDER BY st.name ASC`,
      [id, assessment.class_id],
    );

    const students = rows.map((r: any) => ({
      student_id: r.student_id,
      student_name: r.student_name,
      student_id_number: r.student_id_number,
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
