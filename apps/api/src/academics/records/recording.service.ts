import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { User } from '../../entities/user.entity';
import {
  BULLETIN_ORDER, BulletinCode, canonicalSubject, midtermCopy, NURSERY_AREAS, NURSERY_CODES,
  NURSERY_DECISIONS, NURSERY_RATINGS, NurseryDecision, NurseryRating, primaryYear,
} from './bulletin';
import { ensureBulletinSubjects } from './bulletin-setup';
import { bandOf } from './school-band';

const SUPERVISORS = ['dean', 'principal', 'super_admin'];

export interface RecordingScoreInput { student_id: number; subject_id: number; score?: number | null }
export interface RecordingRatingInput { student_id: number; subject_code: string; rating?: NurseryRating | null }
export interface RecordingTextInput { student_id: number; observation?: string | null }
export interface RecordingDecisionInput { student_id: number; decision?: NurseryDecision | null }

export interface SaveRecordingInput {
  class_id: number;
  term_id: number;
  scores?: RecordingScoreInput[];
  ratings?: RecordingRatingInput[];
  observations?: RecordingTextInput[];
  decisions?: RecordingDecisionInput[];
}

@Injectable()
export class RecordingService {
  constructor(@InjectDataSource() private db: DataSource) {}

  async sheet(user: User, classId?: number, termId?: number) {
    const year = await this.activeYear();
    if (!year) return { academic_year: null, current_term_id: null, classes: [], terms: [], sheet: null };

    const terms = await this.db.query(
      `SELECT id, name, sequence, status, start_date::text AS start_date, end_date::text AS end_date
       FROM terms WHERE academic_year_id = $1 ORDER BY sequence ASC`,
      [year.id],
    );
    const classes = await this.classesFor(user, year.id);
    const current = terms.find((t: any) => t.status === 'active') ?? null;
    const chosenTerm = termId ? terms.find((t: any) => t.id === termId) : current;

    let sheet = null;
    if (classId) {
      const cls = classes.find((c) => c.id === classId);
      if (!cls) throw new ForbiddenException('You do not record marks for this class');
      if (termId && !terms.some((t: any) => t.id === termId)) {
        throw new BadRequestException('That term belongs to a different academic year');
      }
      if (chosenTerm) {
        sheet = cls.mode === 'nursery'
          ? await this.nurserySheet(cls, chosenTerm, year.id)
          : await this.midtermSheet(user, cls, chosenTerm);
      }
    }

    return {
      academic_year: year,
      current_term_id: current?.id ?? null,
      classes,
      terms,
      sheet,
    };
  }

  async save(user: User, dto: SaveRecordingInput) {
    const loaded = await this.sheet(user, dto.class_id, dto.term_id);
    const sheet = loaded.sheet;
    if (!sheet) throw new BadRequestException('Choose a class');
    const term = sheet.term;
    const touchingMarks = !!(dto.scores?.length || dto.ratings?.length || dto.observations?.length);
    if (touchingMarks && term.status !== 'active') {
      throw new BadRequestException(
        term.status === 'closed'
          ? `${term.name} is closed. Its marks stay as they were recorded.`
          : `${term.name} is not open yet. The dean opens the term before marks are recorded.`,
      );
    }

    const roster = new Set(sheet.students.map((s: any) => s.id));
    const onRoster = (id: number) => {
      if (!roster.has(id)) throw new BadRequestException('One of these pupils is not in this class');
    };

    await this.db.transaction(async (manager) => {
      if (sheet.mode === 'midterm') {
        const allowed = new Map<number, number>(
          sheet.subjects.map((s: { id: number; max: number }) => [s.id, Number(s.max)]),
        );
        for (const entry of dto.scores ?? []) {
          onRoster(entry.student_id);
          const max = allowed.get(entry.subject_id);
          if (max === undefined) throw new ForbiddenException('That subject is not yours to record in this class');
          if (entry.score === null || entry.score === undefined) {
            await manager.query(
              `DELETE FROM midterm_scores WHERE term_id = $1 AND student_id = $2 AND subject_id = $3`,
              [term.id, entry.student_id, entry.subject_id],
            );
            continue;
          }
          if (entry.score < 0 || entry.score > max) {
            throw new BadRequestException(`A mark must be between 0 and ${max}`);
          }
          const score = Math.round(entry.score * 100) / 100;
          await manager.query(
            `INSERT INTO midterm_scores (class_id, subject_id, term_id, student_id, score, updated_by, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, now())
             ON CONFLICT (term_id, student_id, subject_id)
             DO UPDATE SET score = EXCLUDED.score, class_id = EXCLUDED.class_id,
               updated_by = EXCLUDED.updated_by, updated_at = now()`,
            [dto.class_id, entry.subject_id, term.id, entry.student_id, score, user.id],
          );
        }
      } else {
        for (const entry of dto.ratings ?? []) {
          onRoster(entry.student_id);
          if (!NURSERY_CODES.includes(entry.subject_code)) {
            throw new BadRequestException('That activity is not on the nursery bulletin');
          }
          if (entry.rating && !NURSERY_RATINGS.includes(entry.rating)) {
            throw new BadRequestException('Choose Excellent, Très bon, Bon or Assez bon');
          }
          if (!entry.rating) {
            await manager.query(
              `DELETE FROM nursery_ratings WHERE term_id = $1 AND student_id = $2 AND subject_code = $3`,
              [term.id, entry.student_id, entry.subject_code],
            );
            continue;
          }
          await manager.query(
            `INSERT INTO nursery_ratings
               (class_id, term_id, student_id, subject_code, rating, updated_by, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, now())
             ON CONFLICT (term_id, student_id, subject_code)
             DO UPDATE SET rating = EXCLUDED.rating, class_id = EXCLUDED.class_id,
               updated_by = EXCLUDED.updated_by, updated_at = now()`,
            [dto.class_id, term.id, entry.student_id, entry.subject_code, entry.rating, user.id],
          );
        }
        for (const entry of dto.observations ?? []) {
          onRoster(entry.student_id);
          const text = (entry.observation ?? '').replace(/\s+/g, ' ').trim();
          if (!text) {
            await manager.query(
              `DELETE FROM nursery_observations WHERE term_id = $1 AND student_id = $2`,
              [term.id, entry.student_id],
            );
            continue;
          }
          if (text.length > 100) throw new BadRequestException('An observation can be at most 100 characters');
          await manager.query(
            `INSERT INTO nursery_observations (term_id, student_id, observation, updated_by, updated_at)
             VALUES ($1, $2, $3, $4, now())
             ON CONFLICT (term_id, student_id)
             DO UPDATE SET observation = EXCLUDED.observation, updated_by = EXCLUDED.updated_by, updated_at = now()`,
            [term.id, entry.student_id, text, user.id],
          );
        }
        const yearId = loaded.academic_year?.id;
        for (const entry of dto.decisions ?? []) {
          onRoster(entry.student_id);
          if (entry.decision && !NURSERY_DECISIONS.some((d) => d.value === entry.decision)) {
            throw new BadRequestException('The deliberation must be promu, redoublement or renvoyé');
          }
          if (!entry.decision) {
            await manager.query(
              `DELETE FROM nursery_decisions WHERE academic_year_id = $1 AND student_id = $2`,
              [yearId, entry.student_id],
            );
            continue;
          }
          await manager.query(
            `INSERT INTO nursery_decisions (academic_year_id, student_id, decision, updated_by, updated_at)
             VALUES ($1, $2, $3, $4, now())
             ON CONFLICT (academic_year_id, student_id)
             DO UPDATE SET decision = EXCLUDED.decision, updated_by = EXCLUDED.updated_by, updated_at = now()`,
            [yearId, entry.student_id, entry.decision, user.id],
          );
        }
      }
    });

    return this.sheet(user, dto.class_id, dto.term_id);
  }

  private async classesFor(user: User, yearId: number) {
    const supervisor = SUPERVISORS.includes(user.role);
    const rows: any[] = await this.db.query(
      `SELECT DISTINCT c.id, c.name, c.teacher_id, pl.id AS p_level_id, pl.name AS p_level_name
       FROM classes c
       JOIN p_levels pl ON pl.id = c.p_level_id
       LEFT JOIN teaching_assignments ta ON ta.class_id = c.id AND ta.teacher_id = $1
       WHERE pl.academic_year_id = $2
         AND c.status = 'active' AND c.distributed_at IS NOT NULL
         AND ($3::boolean OR c.teacher_id = $1 OR ta.id IS NOT NULL)
       ORDER BY pl.name ASC, c.name ASC`,
      [user.id, yearId, supervisor],
    );
    return rows.map((c) => ({
      id: c.id,
      label: `${c.p_level_name}${c.name}`,
      p_level_id: c.p_level_id,
      p_level_name: c.p_level_name,
      class_name: c.name,
      teacher_id: c.teacher_id,
      mode: bandOf(c.p_level_name) === 'nursery' ? 'nursery' as const : 'midterm' as const,
      role: c.teacher_id === user.id ? 'class_teacher' as const : 'teacher' as const,
    }));
  }

  private async roster(classId: number) {
    return this.db.query(
      `SELECT id, name, student_id_number FROM students
       WHERE current_class_id = $1 AND status::text <> 'transferred'
       ORDER BY name ASC`,
      [classId],
    );
  }

  private async midtermSheet(user: User, cls: any, term: any) {
    await ensureBulletinSubjects(this.db);
    const year = primaryYear(cls.p_level_name);
    if (!year) throw new BadRequestException('This class does not have a mid-term bulletin');
    const copy = midtermCopy(year);
    const supervisor = SUPERVISORS.includes(user.role);
    const classTeacher = cls.teacher_id === user.id || supervisor;

    const subjects: any[] = await this.db.query(
      `SELECT id, name, code, report_max FROM subjects
       WHERE p_level_id = $1 AND status = 'active' AND report_max IS NOT NULL
       ORDER BY display_order ASC, name ASC`,
      [cls.p_level_id],
    );
    let mine = subjects
      .map((s) => {
        const code = canonicalSubject(s.code, s.name);
        return code ? { ...s, canon: code, max: Number(s.report_max ?? copy.subjects.find((x) => x.code === code)?.max) } : null;
      })
      .filter(Boolean) as { id: number; canon: BulletinCode; max: number }[];

    if (!classTeacher) {
      const assigned: { subject_id: number }[] = await this.db.query(
        `SELECT subject_id FROM teaching_assignments WHERE teacher_id = $1 AND class_id = $2`,
        [user.id, cls.id],
      );
      const ids = new Set(assigned.map((a) => a.subject_id));
      mine = mine.filter((s) => ids.has(s.id));
    }

    mine.sort((a, b) => BULLETIN_ORDER.indexOf(a.canon) - BULLETIN_ORDER.indexOf(b.canon));
    const students = await this.roster(cls.id);
    const scores: any[] = mine.length && students.length
      ? await this.db.query(
          `SELECT student_id, subject_id, score FROM midterm_scores
           WHERE class_id = $1 AND term_id = $2 AND subject_id = ANY($3)`,
          [cls.id, term.id, mine.map((s) => s.id)],
        )
      : [];

    return {
      mode: 'midterm' as const,
      class_id: cls.id,
      label: cls.label,
      term,
      locked: term.status !== 'active',
      students,
      subjects: mine.map((s) => ({
        id: s.id,
        code: s.canon,
        name: copy.subjects.find((x) => x.code === s.canon)?.name ?? s.canon,
        max: Number(copy.subjects.find((x) => x.code === s.canon)?.max ?? s.max),
      })),
      scores: scores.map((r) => ({ student_id: r.student_id, subject_id: r.subject_id, score: Number(r.score) })),
    };
  }

  private async nurserySheet(cls: any, term: any, yearId: number) {
    const students = await this.roster(cls.id);
    const ids = students.map((s: any) => s.id);
    const ratings: any[] = ids.length
      ? await this.db.query(
          `SELECT student_id, subject_code, rating FROM nursery_ratings
           WHERE class_id = $1 AND term_id = $2 AND student_id = ANY($3)`,
          [cls.id, term.id, ids],
        )
      : [];
    const observations: any[] = ids.length
      ? await this.db.query(
          `SELECT student_id, observation FROM nursery_observations
           WHERE term_id = $1 AND student_id = ANY($2)`,
          [term.id, ids],
        )
      : [];
    const decisions: any[] = ids.length
      ? await this.db.query(
          `SELECT student_id, decision FROM nursery_decisions
           WHERE academic_year_id = $1 AND student_id = ANY($2)`,
          [yearId, ids],
        )
      : [];
    return {
      mode: 'nursery' as const,
      class_id: cls.id,
      label: cls.label,
      term,
      locked: term.status !== 'active',
      students,
      areas: NURSERY_AREAS,
      ratings,
      observations,
      decisions,
    };
  }

  private async activeYear(): Promise<{ id: number; name: string } | null> {
    const rows = await this.db.query(
      `SELECT id, name FROM academic_years WHERE status = 'active' ORDER BY id DESC LIMIT 1`,
    );
    return rows[0] ?? null;
  }
}
