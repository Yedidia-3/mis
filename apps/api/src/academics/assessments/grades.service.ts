import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AssessmentType } from '../../entities/assessment-type.entity';
import { Class } from '../../entities/class.entity';
import { Term } from '../../entities/term.entity';
import { User } from '../../entities/user.entity';
import {
  ScoredAssessment,
  TypeWeight,
  computeOverallAverage,
  computeSubjectGrade,
  computeYearPerformance,
  rankByAverage,
} from './grade-calculator';

/** Roles that may read any class's grades. Teachers are limited to their own. */
const SUPERVISOR_ROLES = ['dean', 'principal', 'super_admin'];

export interface SubjectGradeRow {
  subject_id: number;
  subject_name: string;
  subject_code: string;
  percentage: number | null;
}

export interface StudentGradeRow {
  student_id: number;
  student_name: string;
  subjects: SubjectGradeRow[];
  average: number | null;
  position: number | null;
}

/**
 * Turns recorded marks into grades.
 *
 * Kept separate from AssessmentsService, which is about capturing marks. This
 * is about interpreting them — the queries and the rules differ enough that
 * mixing the two made both harder to follow.
 */
@Injectable()
export class GradesService {
  constructor(
    @InjectRepository(Class) private classRepo: Repository<Class>,
    @InjectRepository(Term) private termRepo: Repository<Term>,
    @InjectRepository(AssessmentType) private typeRepo: Repository<AssessmentType>,
  ) {}

  // ─── Access control ──────────────────────────────────────────────────────────

  private async assertMayReadClass(classId: number, user: User) {
    const cls = await this.classRepo.findOne({ where: { id: classId } });
    if (!cls) throw new NotFoundException('Class not found');

    if (SUPERVISOR_ROLES.includes(user.role)) return cls;
    if (cls.teacher_id !== user.id) {
      throw new ForbiddenException('You are not assigned to this class');
    }
    return cls;
  }

  private async weightsForYear(academicYearId: number): Promise<TypeWeight[]> {
    const types = await this.typeRepo.find({
      where: { academic_year_id: academicYearId, status: 'active' },
    });
    return types.map((t) => ({
      assessmentTypeId: t.id,
      weight: Number(t.weight),
    }));
  }

  // ─── Class grade sheet ───────────────────────────────────────────────────────

  /**
   * Every student in a class, graded across every subject, ranked by average.
   *
   * The whole class is computed in one pass rather than per student, because
   * class position is only meaningful relative to the others — working out one
   * child's placing means grading all of them anyway.
   *
   * Only submitted assessments count. A draft is the teacher's working copy and
   * must never reach a grade a parent might see.
   */
  async getClassTermGrades(classId: number, termId: number, user: User) {
    const cls = await this.assertMayReadClass(classId, user);

    const term = await this.termRepo.findOne({ where: { id: termId } });
    if (!term) throw new NotFoundException('Term not found');

    const weights = await this.weightsForYear(term.academic_year_id);

    const subjects: { id: number; name: string; code: string }[] = await this.classRepo.query(
      `SELECT id, name, code FROM subjects
       WHERE p_level_id = $1 AND status = 'active'
       ORDER BY display_order ASC, name ASC`,
      [cls.p_level_id],
    );

    const students: { id: number; name: string }[] = await this.classRepo.query(
      `SELECT id, name FROM students WHERE current_class_id = $1 ORDER BY name ASC`,
      [classId],
    );

    // Marks are fetched via assessment_scores rather than via the class, so a
    // child who changed class mid-term keeps the marks they actually earned.
    const marks: {
      student_id: number;
      subject_id: number;
      assessment_type_id: number;
      score: string | null;
      is_absent: boolean;
      max_score: string;
    }[] = await this.classRepo.query(
      `SELECT sc.student_id, a.subject_id, a.assessment_type_id,
              sc.score, sc.is_absent, a.max_score
       FROM assessment_scores sc
       JOIN assessments a ON a.id = sc.assessment_id
       WHERE a.term_id = $1
         AND a.status = 'submitted'
         AND sc.student_id = ANY($2::int[])`,
      [termId, students.map((s) => s.id)],
    );

    // student -> subject -> the marks that count toward that subject's grade
    const byStudent = new Map<number, Map<number, ScoredAssessment[]>>();
    for (const m of marks) {
      if (!byStudent.has(m.student_id)) byStudent.set(m.student_id, new Map());
      const bySubject = byStudent.get(m.student_id)!;
      if (!bySubject.has(m.subject_id)) bySubject.set(m.subject_id, []);

      bySubject.get(m.subject_id)!.push({
        assessmentTypeId: m.assessment_type_id,
        // An absence carries no mark; the calculator excludes it rather than
        // treating it as a zero.
        score: m.is_absent || m.score === null ? null : Number(m.score),
        maxScore: Number(m.max_score),
      });
    }

    const graded = students.map((student) => {
      const bySubject = byStudent.get(student.id) ?? new Map();

      const subjectRows: SubjectGradeRow[] = subjects.map((subject) => ({
        subject_id: subject.id,
        subject_name: subject.name,
        subject_code: subject.code,
        percentage: computeSubjectGrade(bySubject.get(subject.id) ?? [], weights).percentage,
      }));

      return {
        student: { student_id: student.id, student_name: student.name, subjects: subjectRows },
        average: computeOverallAverage(subjectRows.map((s) => s.percentage)),
      };
    });

    const ranked = rankByAverage(graded.map((g) => ({ student: g.student, average: g.average })));

    const rows: StudentGradeRow[] = ranked.map((r) => ({
      ...r.student,
      average: r.average,
      position: r.position,
    }));

    return {
      class_id: classId,
      term: { id: term.id, name: term.name, status: term.status },
      subjects,
      weights_used: weights,
      students: rows,
    };
  }

  // ─── One student ─────────────────────────────────────────────────────────────

  private async classOfStudent(studentId: number): Promise<number> {
    const rows = await this.classRepo.query(
      `SELECT current_class_id FROM students WHERE id = $1`,
      [studentId],
    );
    if (!rows.length || !rows[0].current_class_id) {
      throw new NotFoundException('Student is not in a class');
    }
    return rows[0].current_class_id;
  }

  /** One student's subject grades for a term, with their position in the class. */
  async getStudentTermGrades(studentId: number, termId: number, user: User) {
    const classId = await this.classOfStudent(studentId);
    const sheet = await this.getClassTermGrades(classId, termId, user);

    const student = sheet.students.find((s) => s.student_id === studentId);
    if (!student) throw new NotFoundException('Student not found in this class');

    return {
      ...student,
      term: sheet.term,
      class_size: sheet.students.length,
      weights_used: sheet.weights_used,
    };
  }

  /**
   * A student's performance across the whole year.
   *
   * Terms are independent while they run; this is the one place they are
   * joined. The annual figure is withheld until every term exists and is
   * closed — a number labelled "year performance" that is really just Term 1
   * would be read as final by whoever receives it.
   */
  async getStudentYearPerformance(studentId: number, academicYearId: number, user: User) {
    const terms = await this.termRepo.find({
      where: { academic_year_id: academicYearId },
      order: { sequence: 'ASC' },
    });

    const perTerm = [];
    for (const term of terms) {
      const grades = await this.getStudentTermGrades(studentId, term.id, user);
      perTerm.push({
        term: { id: term.id, name: term.name, status: term.status },
        average: grades.average,
        position: grades.position,
        subjects: grades.subjects,
      });
    }

    const year = computeYearPerformance(
      terms.map((t, i) => ({
        termId: t.id,
        isClosed: t.status === 'closed',
        average: perTerm[i].average,
      })),
      terms.length || 3,
    );

    // Per subject, the year figure is the equal mean of its term grades — and
    // only when every term has one, for the same reason as above.
    const subjectIds = new Map<number, { name: string; code: string }>();
    for (const t of perTerm) {
      for (const s of t.subjects) {
        subjectIds.set(s.subject_id, { name: s.subject_name, code: s.subject_code });
      }
    }

    const subjects = [...subjectIds.entries()].map(([id, meta]) => {
      const termGrades = perTerm.map(
        (t) => t.subjects.find((s) => s.subject_id === id)?.percentage ?? null,
      );
      const complete = year.isComplete && !termGrades.some((g) => g === null);

      return {
        subject_id: id,
        subject_name: meta.name,
        subject_code: meta.code,
        term_grades: termGrades,
        year_percentage: complete
          ? Math.round(
              ((termGrades as number[]).reduce((a, b) => a + b, 0) / termGrades.length) * 100,
            ) / 100
          : null,
      };
    });

    return {
      student_id: studentId,
      academic_year_id: academicYearId,
      terms: perTerm,
      subjects,
      year_average: year.average,
      is_complete: year.isComplete,
      closed_term_count: year.closedTermCount,
      expected_term_count: year.expectedTermCount,
    };
  }
}
