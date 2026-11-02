import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ReportKind } from '../../entities/report-card.entity';
import { User } from '../../entities/user.entity';
import { SaveSubjectReportSettingsDto } from './dto/records.dto';
import {
  CellFlag, computeTermSubjects, countFlaggedCells, percentageOf, rankTotals,
  ReportAssessment, ReportCell, ReportMark, ReportSubject, sumCells,
} from './report-builder';
import { bandOf, SCHOOL_BANDS } from './school-band';

/** Printed at the top of every bulletin, as on the school's paper template. */
export const SCHOOL_HEADER = {
  country: 'REPUBLIQUE DU RWANDA',
  ministry: 'MINISTERE DE L’EDUCATION',
  city: 'VILLE DE KIGALI',
  district: 'DISTRICT DE NYARUGENGE',
  sector: 'SECTEUR DE NYAMIRAMBO',
  school: 'JERICHO SCHOOL',
  phone: '0788695562',
  email: 'jericho.school@yahoo.com',
};

export const KIND_LABELS: Record<ReportKind, string> = {
  mid_term: 'Mid-term report',
  end_of_term: 'End of term report',
  end_of_year: 'End of year report',
};

export interface Issue {
  level: 'blocking' | 'warning';
  message: string;
}

export interface SubjectLine {
  subject_id: number;
  name: string;
  code: string;
  group: string | null;
  max: number | null;
  tj?: ReportCell;
  exam?: ReportCell | null;
  terms?: ReportCell[];
  tot: ReportCell;
}

export interface StudentReport {
  student_id: number;
  name: string;
  student_id_number: string | null;
  subjects: SubjectLine[];
  total: number;
  max_total: number;
  percentage: number | null;
  position: number | null;
  class_size: number;
  flagged_count: number;
  flags: string[];
}

export interface TermRow {
  id: number;
  name: string;
  sequence: number;
  status: 'upcoming' | 'active' | 'closed';
  academic_year_id: number;
}

@Injectable()
export class ReportsService {
  constructor(@InjectDataSource() private db: DataSource) {}

  // ─── Lookups ─────────────────────────────────────────────────────────────────

  private async activeYear(): Promise<{ id: number; name: string } | null> {
    const rows = await this.db.query(
      `SELECT id, name FROM academic_years WHERE status = 'active' ORDER BY id DESC LIMIT 1`,
    );
    return rows[0] ?? null;
  }

  private async loadClass(classId: number) {
    const rows: any[] = await this.db.query(
      `SELECT c.id, c.name, c.teacher_id, c.status, c.distributed_at,
              pl.id AS p_level_id, pl.name AS p_level_name, pl.academic_year_id,
              ay.name AS academic_year_name, u.name AS class_teacher_name
       FROM classes c
       JOIN p_levels pl ON pl.id = c.p_level_id
       JOIN academic_years ay ON ay.id = pl.academic_year_id
       LEFT JOIN users u ON u.id = c.teacher_id
       WHERE c.id = $1`,
      [classId],
    );
    if (!rows.length) throw new NotFoundException('Class not found');
    const c = rows[0];
    return { ...c, label: `${c.p_level_name}${c.name}`, band: bandOf(c.p_level_name) };
  }

  private async loadTerm(termId: number, yearId: number): Promise<TermRow> {
    const rows: TermRow[] = await this.db.query(
      `SELECT id, name, sequence, status, academic_year_id FROM terms WHERE id = $1`,
      [termId],
    );
    if (!rows.length) throw new NotFoundException('Term not found');
    if (rows[0].academic_year_id !== yearId) {
      throw new BadRequestException('That term belongs to a different academic year');
    }
    return rows[0];
  }

  private async roster(classId: number): Promise<{ id: number; name: string; student_id_number: string | null }[]> {
    return this.db.query(
      `SELECT id, name, student_id_number FROM students
       WHERE current_class_id = $1 AND status::text <> 'transferred'
       ORDER BY name ASC`,
      [classId],
    );
  }

  private async subjects(pLevelId: number): Promise<ReportSubject[]> {
    const rows: any[] = await this.db.query(
      `SELECT id, name, code, report_group, report_max FROM subjects
       WHERE p_level_id = $1 AND status = 'active'
       ORDER BY display_order ASC, name ASC`,
      [pLevelId],
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      code: r.code,
      group: r.report_group ?? null,
      max: r.report_max === null ? null : Number(r.report_max),
    }));
  }

  /** Submitted assessments and their marks for a class in one term. */
  private async termMarks(classId: number, termId: number) {
    const assessments: ReportAssessment[] = (await this.db.query(
      `SELECT a.id, a.subject_id, ty.category, a.title, a.max_score
       FROM assessments a
       JOIN assessment_types ty ON ty.id = a.assessment_type_id
       WHERE a.class_id = $1 AND a.term_id = $2 AND a.status = 'submitted' AND ty.category IS NOT NULL`,
      [classId, termId],
    )).map((a: any) => ({ ...a, max_score: Number(a.max_score) }));

    const marks = new Map<string, ReportMark>();
    if (assessments.length) {
      const rows: any[] = await this.db.query(
        `SELECT assessment_id, student_id, score, is_absent FROM assessment_scores
         WHERE assessment_id = ANY($1)`,
        [assessments.map((a) => a.id)],
      );
      for (const r of rows) {
        marks.set(`${r.assessment_id}:${r.student_id}`, {
          assessment_id: r.assessment_id,
          student_id: r.student_id,
          score: r.score === null ? null : Number(r.score),
          is_absent: r.is_absent,
        });
      }
    }

    const drafts: { subject_name: string; n: number }[] = await this.db.query(
      `SELECT s.name AS subject_name, COUNT(*)::int AS n
       FROM assessments a JOIN subjects s ON s.id = a.subject_id
       WHERE a.class_id = $1 AND a.term_id = $2 AND a.status = 'draft'
       GROUP BY s.name ORDER BY s.name`,
      [classId, termId],
    );
    return { assessments, marks, drafts };
  }

  // ─── Building a class's reports ──────────────────────────────────────────────

  /**
   * Every student's report for one class, with the problems that would make a
   * printed bulletin wrong. Blocking issues stop generation outright; warnings
   * and flagged cells need the dean's explicit confirmation.
   */
  async buildClass(classId: number, kind: ReportKind, termId?: number) {
    const cls = await this.loadClass(classId);
    const issues: Issue[] = [];
    const subjects = await this.subjects(cls.p_level_id);
    const roster = await this.roster(classId);

    if (!subjects.length) issues.push({ level: 'blocking', message: `${cls.p_level_name} has no subjects` });
    const unset = subjects.filter((s) => s.max === null);
    if (unset.length) {
      issues.push({
        level: 'blocking',
        message: `No report maximum set for ${unset.map((s) => s.name).join(', ')}`,
      });
    }
    if (!roster.length) issues.push({ level: 'blocking', message: 'This class has no students' });

    let term: TermRow | null = null;
    let terms: TermRow[] = [];
    let lines = new Map<number, SubjectLine[]>();

    if (kind === 'end_of_year') {
      terms = await this.db.query(
        `SELECT id, name, sequence, status, academic_year_id FROM terms
         WHERE academic_year_id = $1 ORDER BY sequence ASC`,
        [cls.academic_year_id],
      );
      terms = terms.filter((t) => t.sequence >= 1 && t.sequence <= 3);
      for (const seq of [1, 2, 3]) {
        if (!terms.some((t) => t.sequence === seq)) {
          issues.push({ level: 'blocking', message: `Term ${seq} has not been set up for ${cls.academic_year_name}` });
        }
      }
      if (!issues.some((i) => i.level === 'blocking')) {
        lines = await this.buildYearLines(classId, subjects, roster, terms, issues);
      }
    } else {
      if (!termId) throw new BadRequestException('Choose a term');
      term = await this.loadTerm(termId, cls.academic_year_id);
      if (kind === 'end_of_term' && term.status !== 'closed') {
        issues.push({ level: 'warning', message: `${term.name} is not closed yet, so marks may still change` });
      }
      if (!issues.some((i) => i.level === 'blocking')) {
        const { assessments, marks, drafts } = await this.termMarks(classId, term.id);
        this.draftWarnings(drafts, term.name, issues);
        this.coverageWarnings(kind, subjects, assessments, term.name, issues);
        for (const st of roster) {
          const results = computeTermSubjects(kind, subjects, assessments, marks, st.id);
          lines.set(st.id, subjects.map((s, i) => ({
            subject_id: s.id, name: s.name, code: s.code, group: s.group, max: s.max,
            tj: results[i].tj,
            exam: results[i].exam,
            tot: results[i].tot,
          })));
        }
      }
    }

    const students: StudentReport[] = roster.map((st) => {
      const subjectLines = lines.get(st.id) ?? [];
      const cells = this.cellsOf(subjectLines);
      const { total, max } = sumCells(subjectLines.map((l) => l.tot));
      const flags = [...new Set(cells.flatMap((c) => c.flags.map((f) => f.message)))];
      return {
        student_id: st.id,
        name: st.name,
        student_id_number: st.student_id_number,
        subjects: subjectLines,
        total,
        max_total: max,
        percentage: subjectLines.length ? percentageOf(total, max) : null,
        position: null,
        class_size: roster.length,
        flagged_count: countFlaggedCells(cells),
        flags,
      };
    });

    if (lines.size) {
      const ranks = rankTotals(students.map((s) => ({ id: s.student_id, total: s.total })));
      for (const s of students) s.position = ranks.get(s.student_id) ?? null;
    }

    return {
      header: {
        ...SCHOOL_HEADER,
        kind,
        kind_label: KIND_LABELS[kind],
        academic_year: cls.academic_year_name,
        term: term ? { id: term.id, name: term.name, status: term.status } : null,
        terms: terms.map((t) => ({ id: t.id, name: t.name, sequence: t.sequence, status: t.status })),
        class: { id: cls.id, label: cls.label, p_level: cls.p_level_name, p_level_id: cls.p_level_id, band: cls.band },
        class_teacher: cls.class_teacher_name ?? null,
      },
      subjects,
      issues,
      can_generate: !issues.some((i) => i.level === 'blocking'),
      students,
    };
  }

  private cellsOf(lines: SubjectLine[]): ReportCell[] {
    return lines.flatMap((l) => [
      ...(l.tj ? [l.tj] : []),
      ...(l.exam ? [l.exam] : []),
      ...(l.terms ?? []),
    ]);
  }

  private draftWarnings(drafts: { subject_name: string; n: number }[], termName: string, issues: Issue[]) {
    for (const d of drafts) {
      issues.push({
        level: 'warning',
        message: `${d.n} ${d.subject_name} assessment${d.n === 1 ? ' is' : 's are'} still a draft in ${termName} and not counted`,
      });
    }
  }

  private coverageWarnings(
    kind: 'mid_term' | 'end_of_term',
    subjects: ReportSubject[],
    assessments: ReportAssessment[],
    termName: string,
    issues: Issue[],
  ) {
    const noCat = subjects.filter((s) => !assessments.some((a) => a.subject_id === s.id && a.category !== 'exam'));
    if (noCat.length) {
      issues.push({ level: 'warning', message: `No quiz or homework submitted in ${termName} for ${noCat.map((s) => s.name).join(', ')}` });
    }
    if (kind === 'end_of_term') {
      const noExam = subjects.filter((s) => !assessments.some((a) => a.subject_id === s.id && a.category === 'exam'));
      if (noExam.length) {
        issues.push({ level: 'warning', message: `No exam submitted in ${termName} for ${noExam.map((s) => s.name).join(', ')}` });
      }
    }
  }

  /** End of year: each term's subject total side by side, then the annual total. */
  private async buildYearLines(
    classId: number,
    subjects: ReportSubject[],
    roster: { id: number }[],
    terms: TermRow[],
    issues: Issue[],
  ) {
    const perTerm = [];
    for (const term of terms) {
      const data = await this.termMarks(classId, term.id);
      this.draftWarnings(data.drafts, term.name, issues);
      this.coverageWarnings('end_of_term', subjects, data.assessments, term.name, issues);
      if (term.status !== 'closed') {
        issues.push({ level: 'warning', message: `${term.name} is not closed yet, so its marks may still change` });
      }
      perTerm.push({ term, ...data });
    }

    const lines = new Map<number, SubjectLine[]>();
    for (const st of roster) {
      const termResults = perTerm.map((t) =>
        computeTermSubjects('end_of_term', subjects, t.assessments, t.marks, st.id));
      lines.set(st.id, subjects.map((s, i) => {
        const termCells: ReportCell[] = termResults.map((results, ti) => {
          const r = results[i];
          const flags: CellFlag[] = [...r.tj.flags, ...(r.exam?.flags ?? [])]
            .map((f) => ({ ...f, message: `${perTerm[ti].term.name}: ${f.message}` }));
          if (perTerm[ti].term.status !== 'closed') {
            flags.push({ code: 'term_incomplete', message: `${perTerm[ti].term.name} is not closed` });
          }
          return { value: r.tot.value, max: r.tot.max, flags };
        });
        const { total, max } = sumCells(termCells);
        return {
          subject_id: s.id, name: s.name, code: s.code, group: s.group, max: s.max,
          terms: termCells,
          tot: s.max === null ? { value: null, max: null, flags: [] } : { value: total, max, flags: [] },
        };
      }));
    }
    return lines;
  }

  // ─── Endpoints ───────────────────────────────────────────────────────────────

  /** Classes of the active year by section, with how many reports exist for the chosen period. */
  async listClasses(kind: ReportKind, termId?: number) {
    const year = await this.activeYear();
    if (!year) return { academic_year: null, terms: [], sections: [] };
    const terms = await this.db.query(
      `SELECT id, name, sequence, status, start_date::text AS start_date, end_date::text AS end_date
       FROM terms WHERE academic_year_id = $1 ORDER BY sequence ASC`,
      [year.id],
    );
    if (kind !== 'end_of_year' && termId && !terms.some((t: any) => t.id === termId)) {
      throw new BadRequestException('That term belongs to a different academic year');
    }

    const classes: any[] = await this.db.query(
      `SELECT c.id, c.name, pl.id AS p_level_id, pl.name AS p_level_name, u.name AS class_teacher_name,
              (SELECT COUNT(*)::int FROM students st
                 WHERE st.current_class_id = c.id AND st.status::text <> 'transferred') AS student_count,
              (SELECT COUNT(*)::int FROM report_cards rc
                 JOIN students st ON st.id = rc.student_id
                 WHERE rc.class_id = c.id AND rc.kind = $2 AND rc.academic_year_id = $1
                   AND rc.term_id IS NOT DISTINCT FROM $3::int
                   AND st.current_class_id = c.id AND st.status::text <> 'transferred') AS generated_count
       FROM classes c
       JOIN p_levels pl ON pl.id = c.p_level_id
       LEFT JOIN users u ON u.id = c.teacher_id
       WHERE pl.academic_year_id = $1 AND c.status = 'active' AND c.distributed_at IS NOT NULL
       ORDER BY pl.name ASC, c.name ASC`,
      [year.id, kind, kind === 'end_of_year' ? null : termId ?? null],
    );

    const sections = SCHOOL_BANDS.map((b) => ({
      key: b.key,
      label: b.label,
      classes: classes
        .filter((c) => bandOf(c.p_level_name) === b.key)
        .map((c) => ({ ...c, label: `${c.p_level_name}${c.name}` })),
    }));
    return { academic_year: year, terms, sections };
  }

  async preview(classId: number, kind: ReportKind, termId?: number) {
    const built = await this.buildClass(classId, kind, termId);
    const stored: any[] = await this.db.query(
      `SELECT student_id, generated_at FROM report_cards
       WHERE class_id = $1 AND kind = $2 AND term_id IS NOT DISTINCT FROM $3::int`,
      [classId, kind, kind === 'end_of_year' ? null : termId ?? null],
    );
    const generatedAt = new Map(stored.map((r) => [r.student_id, r.generated_at]));
    return {
      ...built,
      students: built.students.map((s) => ({ ...s, generated_at: generatedAt.get(s.student_id) ?? null })),
    };
  }

  async generate(
    dto: { class_id: number; kind: ReportKind; term_id?: number; student_ids?: number[]; confirm_incomplete: boolean },
    user: User,
  ) {
    const termId = dto.kind === 'end_of_year' ? undefined : dto.term_id;
    const built = await this.buildClass(dto.class_id, dto.kind, termId);

    const blocking = built.issues.filter((i) => i.level === 'blocking');
    if (blocking.length) {
      throw new BadRequestException(`Reports cannot be generated: ${blocking.map((i) => i.message).join('; ')}`);
    }

    let chosen = built.students;
    if (dto.student_ids && dto.student_ids.length) {
      const byId = new Map(built.students.map((s) => [s.student_id, s]));
      const outside = dto.student_ids.filter((id) => !byId.has(id));
      if (outside.length) {
        throw new BadRequestException(`${outside.length} selected student${outside.length === 1 ? ' is' : 's are'} not in this class`);
      }
      chosen = dto.student_ids.map((id) => byId.get(id) as StudentReport);
    }
    if (!chosen.length) throw new BadRequestException('Select at least one student');

    const flagged = chosen.filter((s) => s.flagged_count > 0).length;
    const warnings = built.issues.filter((i) => i.level === 'warning').length;
    if ((flagged || warnings) && !dto.confirm_incomplete) {
      throw new BadRequestException(
        `${flagged} report${flagged === 1 ? ' has' : 's have'} flagged cells and there ${warnings === 1 ? 'is 1 warning' : `are ${warnings} warnings`}. Review them and confirm to generate anyway.`,
      );
    }

    const named = await this.db.query(`SELECT name FROM users WHERE id = $1`, [user.id]);
    const generatedBy = named[0]?.name ?? null;
    const yearRow = await this.db.query(
      `SELECT pl.academic_year_id FROM classes c JOIN p_levels pl ON pl.id = c.p_level_id WHERE c.id = $1`,
      [dto.class_id],
    );
    const yearId: number = yearRow[0].academic_year_id;

    await this.db.transaction(async (manager) => {
      for (const s of chosen) {
        const payload = {
          header: built.header,
          student: { id: s.student_id, name: s.name, student_id_number: s.student_id_number },
          subjects: s.subjects,
          total: s.total,
          max_total: s.max_total,
          percentage: s.percentage,
          position: s.position,
          class_size: s.class_size,
          flagged_count: s.flagged_count,
          flags: s.flags,
          generated_by: generatedBy,
        };
        await manager.query(
          `INSERT INTO report_cards
             (student_id, class_id, academic_year_id, term_id, kind, payload, flagged_count,
              total, max_total, percentage, position, class_size, generated_by, generated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now())
           ON CONFLICT (student_id, kind, academic_year_id, COALESCE(term_id, 0))
           DO UPDATE SET class_id = EXCLUDED.class_id, payload = EXCLUDED.payload,
             flagged_count = EXCLUDED.flagged_count, total = EXCLUDED.total,
             max_total = EXCLUDED.max_total, percentage = EXCLUDED.percentage,
             position = EXCLUDED.position, class_size = EXCLUDED.class_size,
             generated_by = EXCLUDED.generated_by, generated_at = now()`,
          [
            s.student_id, dto.class_id, yearId, termId ?? null, dto.kind, JSON.stringify(payload),
            s.flagged_count, s.total, s.max_total, s.percentage, s.position, s.class_size, user.id,
          ],
        );
      }
    });

    return {
      generated: chosen.length,
      flagged: flagged,
      message: `Generated ${chosen.length} report${chosen.length === 1 ? '' : 's'} for ${built.header.class.label}`,
    };
  }

  /** Stored reports for printing, in roster order. Students who left the class are not printed. */
  async cards(classId: number, kind: ReportKind, termId?: number) {
    const cls = await this.loadClass(classId);
    const rows: any[] = await this.db.query(
      `SELECT rc.id, rc.student_id, rc.payload, rc.generated_at
       FROM report_cards rc
       JOIN students st ON st.id = rc.student_id
       WHERE rc.class_id = $1 AND rc.kind = $2 AND rc.term_id IS NOT DISTINCT FROM $3::int
         AND st.current_class_id = $1 AND st.status::text <> 'transferred'
       ORDER BY st.name ASC`,
      [classId, kind, kind === 'end_of_year' ? null : termId ?? null],
    );
    return {
      class: { id: cls.id, label: cls.label },
      kind,
      cards: rows.map((r) => ({ ...r.payload, id: r.id, generated_at: r.generated_at })),
    };
  }

  // ─── Report maxima per subject ───────────────────────────────────────────────

  async levelSubjects(pLevelId: number) {
    const level = await this.db.query(`SELECT id, name FROM p_levels WHERE id = $1`, [pLevelId]);
    if (!level.length) throw new NotFoundException('Level not found');
    const rows: any[] = await this.db.query(
      `SELECT id, name, code, display_order, report_max, report_group FROM subjects
       WHERE p_level_id = $1 AND status = 'active'
       ORDER BY display_order ASC, name ASC`,
      [pLevelId],
    );
    return {
      p_level: level[0],
      subjects: rows.map((r) => ({ ...r, report_max: r.report_max === null ? null : Number(r.report_max) })),
    };
  }

  async saveLevelSubjects(pLevelId: number, dto: SaveSubjectReportSettingsDto) {
    const current = await this.levelSubjects(pLevelId);
    const ids = new Set(current.subjects.map((s: any) => s.id));
    const seen = new Set<number>();
    for (const s of dto.subjects) {
      if (seen.has(s.id)) throw new BadRequestException('A subject appears more than once');
      seen.add(s.id);
      if (!ids.has(s.id)) throw new BadRequestException(`Subject ${s.id} is not taught at ${current.p_level.name}`);
    }

    await this.db.transaction(async (manager) => {
      for (const s of dto.subjects) {
        const sets: string[] = [];
        const params: unknown[] = [];
        if (s.report_max !== undefined) { params.push(s.report_max); sets.push(`report_max = $${params.length}`); }
        if (s.report_group !== undefined) { params.push(s.report_group); sets.push(`report_group = $${params.length}`); }
        if (s.display_order !== undefined) { params.push(s.display_order); sets.push(`display_order = $${params.length}`); }
        if (!sets.length) continue;
        params.push(s.id);
        await manager.query(`UPDATE subjects SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
      }
    });
    return this.levelSubjects(pLevelId);
  }
}
