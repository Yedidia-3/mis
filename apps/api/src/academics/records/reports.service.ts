import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ReportKind } from '../../entities/report-card.entity';
import { User } from '../../entities/user.entity';
import { SaveSubjectReportSettingsDto } from './dto/records.dto';
import {
  BulletinCode, canonicalSubject, kigaliToday, MarkCell, midtermCopy, midtermLines, nurseryClassTitle,
  NURSERY_AREAS, NURSERY_SUBJECTS, primaryYear, rankTotals, sumLines,
} from './bulletin';
import { ensureBulletinSubjects } from './bulletin-setup';
import { bandOf, SCHOOL_BANDS } from './school-band';

export const KIND_LABELS: Record<string, string> = {
  mid_term: 'Mid-term',
  nursery: 'Nursery bulletin',
};

export interface Issue {
  level: 'blocking' | 'warning';
  message: string;
}

interface TermRow {
  id: number;
  name: string;
  sequence: number;
  status: 'upcoming' | 'active' | 'closed';
  academic_year_id: number;
  end_date?: string;
}

@Injectable()
export class ReportsService {
  constructor(@InjectDataSource() private db: DataSource) {}

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
      `SELECT id, name, sequence, status, academic_year_id, end_date::text AS end_date
       FROM terms WHERE id = $1`,
      [termId],
    );
    if (!rows.length) throw new NotFoundException('Term not found');
    if (rows[0].academic_year_id !== yearId) {
      throw new BadRequestException('That term belongs to a different academic year');
    }
    return rows[0];
  }

  private async roster(classId: number) {
    return this.db.query(
      `SELECT id, name, student_id_number FROM students
       WHERE current_class_id = $1 AND status::text <> 'transferred'
       ORDER BY name ASC`,
      [classId],
    );
  }

  private assertKind(kind: ReportKind): 'mid_term' | 'nursery' {
    if (kind === 'mid_term' || kind === 'nursery') return kind;
    throw new BadRequestException('End of term and end of year reports are produced in CAMIS. This system prints the nursery bulletin and the mid-term.');
  }

  async buildClass(classId: number, kind: ReportKind, termId?: number) {
    const printed = this.assertKind(kind);
    const cls = await this.loadClass(classId);
    if (printed === 'nursery') return this.buildNursery(cls);
    return this.buildMidterm(cls, termId);
  }

  private async buildMidterm(cls: any, termId?: number) {
    if (cls.band === 'nursery') {
      throw new BadRequestException('Nursery classes use the nursery bulletin, not the mid-term');
    }
    if (!termId) throw new BadRequestException('Choose a term');
    await ensureBulletinSubjects(this.db);
    const year = primaryYear(cls.p_level_name);
    const issues: Issue[] = [];
    if (!year) {
      issues.push({ level: 'blocking', message: `${cls.p_level_name} does not have a mid-term bulletin` });
    }
    const copy = year ? midtermCopy(year) : null;
    const term = await this.loadTerm(termId, cls.academic_year_id);
    const roster = await this.roster(cls.id);
    if (!roster.length) issues.push({ level: 'blocking', message: 'This class has no pupils' });

    const dbSubjects: any[] = year
      ? await this.db.query(
          `SELECT id, name, code, report_max FROM subjects
           WHERE p_level_id = $1 AND status = 'active'
           ORDER BY display_order ASC, name ASC`,
          [cls.p_level_id],
        )
      : [];
    const byCanon = new Map<BulletinCode, any>();
    for (const row of dbSubjects) {
      const code = canonicalSubject(row.code, row.name);
      if (code && !byCanon.has(code)) byCanon.set(code, row);
    }
    const subjects = (copy?.subjects ?? []).map((s) => {
      const row = byCanon.get(s.code);
      return row ? { id: row.id, code: s.code, name: s.name, max: s.max } : null;
    });
    const missing = (copy?.subjects ?? []).filter((s) => !byCanon.has(s.code));
    if (missing.length) {
      issues.push({ level: 'blocking', message: `Missing from ${cls.p_level_name}: ${missing.map((s) => s.name).join(', ')}` });
    }

    const ready = subjects.filter((s): s is { id: number; code: BulletinCode; name: string; max: number } => !!s);
    const scoreRows: any[] = ready.length
      ? await this.db.query(
          `SELECT student_id, subject_id, score FROM midterm_scores
           WHERE class_id = $1 AND term_id = $2 AND subject_id = ANY($3)`,
          [cls.id, term.id, ready.map((s) => s.id)],
        )
      : [];
    const scoreKey = new Map<string, number>(scoreRows.map((r) => [`${r.student_id}:${r.subject_id}`, Number(r.score)]));

    for (const subject of ready) {
      const any = scoreRows.some((r) => r.subject_id === subject.id);
      if (!any) issues.push({ level: 'warning', message: `No marks entered for ${subject.name}` });
    }

    const students = roster.map((st: any) => {
      const lines = midtermLines(ready, (subjectId) => {
        const value = scoreKey.get(`${st.id}:${subjectId}`);
        return value === undefined ? null : value;
      });
      const { total, max, percentage } = sumLines(lines);
      const flags = lines.flatMap((l) => l.points.flags.map((f) => f.message));
      return {
        student_id: st.id,
        name: st.name,
        student_id_number: st.student_id_number,
        subjects: lines,
        nursery: null,
        total,
        max_total: max,
        percentage,
        position: null as number | null,
        class_size: roster.length,
        flagged_count: lines.filter((l) => l.points.flags.length).length,
        flags,
      };
    });
    const ranks = rankTotals(students.map((s) => ({ id: s.student_id, total: s.total })));
    for (const s of students) s.position = ranks.get(s.student_id) ?? null;

    const date = term.end_date || kigaliToday();
    return {
      header: {
        ...(copy ?? {}),
        kind: 'mid_term' as const,
        kind_label: KIND_LABELS.mid_term,
        academic_year: cls.academic_year_name,
        date,
        term: { id: term.id, name: term.name, sequence: term.sequence, status: term.status },
        terms: [],
        areas: [],
        class: {
          id: cls.id,
          label: cls.label,
          p_level: cls.p_level_name,
          p_level_id: cls.p_level_id,
          band: cls.band,
        },
        class_teacher: cls.class_teacher_name ?? null,
      },
      issues,
      can_generate: !issues.some((i) => i.level === 'blocking'),
      students,
    };
  }

  private async buildNursery(cls: any) {
    if (cls.band !== 'nursery') {
      throw new BadRequestException('Only a nursery class uses this bulletin');
    }
    const issues: Issue[] = [];
    const roster = await this.roster(cls.id);
    if (!roster.length) issues.push({ level: 'blocking', message: 'This class has no pupils' });

    const terms: TermRow[] = await this.db.query(
      `SELECT id, name, sequence, status, academic_year_id, end_date::text AS end_date
       FROM terms WHERE academic_year_id = $1 AND sequence BETWEEN 1 AND 3
       ORDER BY sequence ASC`,
      [cls.academic_year_id],
    );
    if (!terms.length) issues.push({ level: 'blocking', message: 'Set up the three terms before printing the nursery bulletin' });

    const ids = roster.map((s: any) => s.id);
    const ratings: any[] = ids.length && terms.length
      ? await this.db.query(
          `SELECT term_id, student_id, subject_code, rating FROM nursery_ratings
           WHERE student_id = ANY($1) AND term_id = ANY($2)`,
          [ids, terms.map((t) => t.id)],
        )
      : [];
    const observations: any[] = ids.length && terms.length
      ? await this.db.query(
          `SELECT term_id, student_id, observation FROM nursery_observations
           WHERE student_id = ANY($1) AND term_id = ANY($2)`,
          [ids, terms.map((t) => t.id)],
        )
      : [];
    const decisions: any[] = ids.length
      ? await this.db.query(
          `SELECT student_id, decision FROM nursery_decisions
           WHERE academic_year_id = $1 AND student_id = ANY($2)`,
          [cls.academic_year_id, ids],
        )
      : [];

    const expected = NURSERY_SUBJECTS.length;
    const openTerms = terms.filter((t) => t.status === 'active' || t.status === 'closed');
    for (const term of openTerms) {
      const filled = new Set(ratings.filter((r) => r.term_id === term.id).map((r) => r.student_id));
      const blankPupils = roster.filter((st: any) => {
        const count = ratings.filter((r) => r.term_id === term.id && r.student_id === st.id).length;
        return count < expected;
      });
      if (blankPupils.length && !filled.size) {
        issues.push({ level: 'warning', message: `No colours recorded in ${term.name}` });
      } else if (blankPupils.length) {
        issues.push({
          level: 'warning',
          message: `${blankPupils.length} pupil${blankPupils.length === 1 ? ' has' : 's have'} a blank colour in ${term.name}`,
        });
      }
    }

    const students = roster.map((st: any) => {
      const termBlocks = [1, 2, 3].map((sequence) => {
        const term = terms.find((t) => t.sequence === sequence);
        const mine = term ? ratings.filter((r) => r.term_id === term.id && r.student_id === st.id) : [];
        const byCode: Record<string, string | null> = {};
        for (const subject of NURSERY_SUBJECTS) {
          byCode[subject.code] = mine.find((r) => r.subject_code === subject.code)?.rating ?? null;
        }
        const observation = term
          ? observations.find((o) => o.term_id === term.id && o.student_id === st.id)?.observation ?? ''
          : '';
        return { sequence, name: term?.name ?? `Term ${sequence}`, ratings: byCode, observation };
      });
      const blanks = openTerms.reduce((n, term) => {
        const block = termBlocks.find((b) => b.sequence === term.sequence);
        return n + Object.values(block?.ratings ?? {}).filter((v) => !v).length;
      }, 0);
      const recorded = termBlocks.reduce((n, b) => n + Object.values(b.ratings).filter(Boolean).length, 0);
      const decision = decisions.find((d) => d.student_id === st.id)?.decision ?? null;
      const flags = blanks ? [`${blanks} colour${blanks === 1 ? '' : 's'} still blank`] : [];
      return {
        student_id: st.id,
        name: st.name,
        student_id_number: st.student_id_number,
        subjects: [] as { points: MarkCell }[],
        nursery: { terms: termBlocks, decision },
        total: recorded,
        max_total: expected * Math.max(openTerms.length, 1),
        percentage: null,
        position: null,
        class_size: roster.length,
        flagged_count: blanks,
        flags,
      };
    });

    return {
      header: {
        layout: 'nursery' as const,
        kind: 'nursery' as const,
        kind_label: KIND_LABELS.nursery,
        country: 'REPUBLIQUE DU RWANDA',
        ministry: "MINISTERE DE L'EDUCATION",
        city: 'VILLE DE KIGALI',
        district: 'DISTRICT DE NYARUGENGE',
        sector: 'SECTEUR DE NYAMIRAMBO',
        school: 'JERICHO SCHOOL',
        phone: '0788695562',
        email: 'jericho.school@yahoo.fr',
        title: 'BULLETIN SCOLAIRE DE LA MATERNELLE',
        academic_year: cls.academic_year_name,
        date: kigaliToday(),
        term: null,
        terms: terms.map((t) => ({ id: t.id, name: t.name, sequence: t.sequence, status: t.status })),
        areas: NURSERY_AREAS,
        class: {
          id: cls.id,
          label: nurseryClassTitle(cls.p_level_name, cls.name),
          p_level: cls.p_level_name,
          p_level_id: cls.p_level_id,
          band: cls.band,
        },
        class_teacher: cls.class_teacher_name ?? null,
      },
      issues,
      can_generate: !issues.some((i) => i.level === 'blocking'),
      students,
    };
  }

  async listClasses(kind: ReportKind, termId?: number) {
    const printed = this.assertKind(kind);
    const year = await this.activeYear();
    if (!year) return { academic_year: null, terms: [], sections: [] };
    const terms = await this.db.query(
      `SELECT id, name, sequence, status, start_date::text AS start_date, end_date::text AS end_date
       FROM terms WHERE academic_year_id = $1 ORDER BY sequence ASC`,
      [year.id],
    );
    if (printed === 'mid_term' && !termId) {
      return { academic_year: year, terms, sections: [] };
    }
    if (printed === 'mid_term' && termId && !terms.some((t: any) => t.id === termId)) {
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
      [year.id, printed, printed === 'nursery' ? null : termId ?? null],
    );

    const bands = SCHOOL_BANDS.filter((b) => (b.key === 'nursery') === (printed === 'nursery'));
    const sections = bands.map((b) => ({
      key: b.key,
      label: b.label,
      classes: classes
        .filter((c) => bandOf(c.p_level_name) === b.key)
        .map((c) => ({
          ...c,
          label: printed === 'nursery' ? nurseryClassTitle(c.p_level_name, c.name) : `${c.p_level_name}${c.name}`,
        })),
    }));
    return { academic_year: year, terms, sections };
  }

  async preview(classId: number, kind: ReportKind, termId?: number) {
    const printed = this.assertKind(kind);
    const built = await this.buildClass(classId, printed, termId);
    const stored: any[] = await this.db.query(
      `SELECT student_id, generated_at FROM report_cards
       WHERE class_id = $1 AND kind = $2 AND term_id IS NOT DISTINCT FROM $3::int`,
      [classId, printed, printed === 'nursery' ? null : termId ?? null],
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
    const printed = this.assertKind(dto.kind);
    const termId = printed === 'nursery' ? undefined : dto.term_id;
    const built = await this.buildClass(dto.class_id, printed, termId);

    const blocking = built.issues.filter((i) => i.level === 'blocking');
    if (blocking.length) {
      throw new BadRequestException(`Reports cannot be generated: ${blocking.map((i) => i.message).join('; ')}`);
    }

    let chosen = built.students;
    if (dto.student_ids && dto.student_ids.length) {
      const byId = new Map(built.students.map((s) => [s.student_id, s]));
      const outside = dto.student_ids.filter((id) => !byId.has(id));
      if (outside.length) {
        throw new BadRequestException(`${outside.length} selected pupil${outside.length === 1 ? ' is' : 's are'} not in this class`);
      }
      chosen = dto.student_ids.map((id) => byId.get(id)!);
    }
    if (!chosen.length) throw new BadRequestException('Select at least one pupil');

    const flagged = chosen.filter((s) => s.flagged_count > 0).length;
    const warnings = built.issues.filter((i) => i.level === 'warning').length;
    if ((flagged || warnings) && !dto.confirm_incomplete) {
      throw new BadRequestException(
        `${flagged} report${flagged === 1 ? ' has' : 's have'} blank cells and there ${warnings === 1 ? 'is 1 warning' : `are ${warnings} warnings`}. Review them and confirm to generate anyway.`,
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
          nursery: s.nursery,
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
            s.student_id, dto.class_id, yearId, termId ?? null, printed, JSON.stringify(payload),
            s.flagged_count, s.total, s.max_total, s.percentage, s.position, s.class_size, user.id,
          ],
        );
      }
    });

    return {
      generated: chosen.length,
      flagged,
      message: `Generated ${chosen.length} ${KIND_LABELS[printed].toLowerCase()} report${chosen.length === 1 ? '' : 's'} for ${built.header.class.label}`,
    };
  }

  async cards(classId: number, kind: ReportKind, termId?: number) {
    const printed = this.assertKind(kind);
    const cls = await this.loadClass(classId);
    const rows: any[] = await this.db.query(
      `SELECT rc.id, rc.student_id, rc.payload, rc.generated_at
       FROM report_cards rc
       JOIN students st ON st.id = rc.student_id
       WHERE rc.class_id = $1 AND rc.kind = $2 AND rc.term_id IS NOT DISTINCT FROM $3::int
         AND st.current_class_id = $1 AND st.status::text <> 'transferred'
       ORDER BY st.name ASC`,
      [classId, printed, printed === 'nursery' ? null : termId ?? null],
    );
    return {
      class: { id: cls.id, label: cls.label },
      kind: printed,
      cards: rows.map((r) => ({ ...r.payload, id: r.id, generated_at: r.generated_at })),
    };
  }

  async levelSubjects(pLevelId: number) {
    await ensureBulletinSubjects(this.db);
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
