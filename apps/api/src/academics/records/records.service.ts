import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { bandOf, SCHOOL_BANDS, SchoolBand } from './school-band';

export interface TeacherRow {
  id: number;
  name: string;
  email: string;
  avatar: string | null;
  type: 'class_teacher' | 'teacher';
  classes: { id: number; label: string; role: 'class_teacher' | 'teacher' }[];
  submitted_count: number;
  last_submitted_at: string | null;
}

/**
 * The dean's view of what teachers have submitted, grouped by section of the
 * school. Read-only: teachers own their marks, the dean only reviews them.
 */
@Injectable()
export class RecordsService {
  constructor(@InjectDataSource() private db: DataSource) {}

  private async activeYear(): Promise<{ id: number; name: string } | null> {
    const rows = await this.db.query(
      `SELECT id, name FROM academic_years WHERE status = 'active' ORDER BY id DESC LIMIT 1`,
    );
    return rows[0] ?? null;
  }

  /** Classes of the active year that teachers can see, each tagged with its section. */
  private async yearClasses(yearId: number) {
    const rows: any[] = await this.db.query(
      `SELECT c.id, c.name, c.teacher_id, pl.id AS p_level_id, pl.name AS p_level_name
       FROM classes c
       JOIN p_levels pl ON pl.id = c.p_level_id
       WHERE pl.academic_year_id = $1 AND c.status = 'active' AND c.distributed_at IS NOT NULL
       ORDER BY pl.name ASC, c.name ASC`,
      [yearId],
    );
    return rows.map((r) => ({ ...r, label: `${r.p_level_name}${r.name}`, band: bandOf(r.p_level_name) }));
  }

  /** Every teacher who teaches in a section, with what they have submitted there. */
  private async teachersFor(yearId: number, band: SchoolBand) {
    const classes = (await this.yearClasses(yearId)).filter((c) => c.band === band);
    if (!classes.length) return { classes, teachers: [] as TeacherRow[] };
    const classIds = classes.map((c) => c.id);
    const labelOf = new Map(classes.map((c) => [c.id, c.label]));

    const links: { teacher_id: number; class_id: number; role: 'class_teacher' | 'teacher' }[] = await this.db.query(
      `SELECT teacher_id, id AS class_id, 'class_teacher' AS role
         FROM classes WHERE id = ANY($1) AND teacher_id IS NOT NULL
       UNION
       SELECT DISTINCT ta.teacher_id, ta.class_id, 'teacher' AS role
         FROM teaching_assignments ta
         JOIN classes c ON c.id = ta.class_id
        WHERE ta.class_id = ANY($1) AND ta.teacher_id IS DISTINCT FROM c.teacher_id`,
      [classIds],
    );
    const teacherIds = [...new Set(links.map((l) => l.teacher_id))];
    if (!teacherIds.length) return { classes, teachers: [] as TeacherRow[] };

    const users: any[] = await this.db.query(
      `SELECT id, name, email, avatar FROM users
       WHERE id = ANY($1) AND role = 'teacher' AND status = 'active'`,
      [teacherIds],
    );
    const stats: any[] = await this.db.query(
      `SELECT a.created_by AS teacher_id, COUNT(*)::int AS submitted_count, MAX(a.submitted_at) AS last_submitted_at
       FROM assessments a
       WHERE a.status = 'submitted' AND a.class_id = ANY($1) AND a.created_by = ANY($2)
       GROUP BY a.created_by`,
      [classIds, teacherIds],
    );
    const statOf = new Map(stats.map((s) => [s.teacher_id, s]));

    const teachers: TeacherRow[] = users.map((u) => {
      const own = links.filter((l) => l.teacher_id === u.id);
      const isClassTeacher = own.some((l) => l.role === 'class_teacher');
      const stat = statOf.get(u.id);
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        avatar: u.avatar ?? null,
        type: isClassTeacher ? 'class_teacher' : 'teacher',
        classes: own
          .map((l) => ({ id: l.class_id, label: labelOf.get(l.class_id) as string, role: l.role }))
          .sort((a, b) => a.label.localeCompare(b.label)),
        submitted_count: stat?.submitted_count ?? 0,
        last_submitted_at: stat?.last_submitted_at ?? null,
      };
    });
    teachers.sort((a, b) =>
      a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'class_teacher' ? -1 : 1,
    );
    return { classes, teachers };
  }

  async sections() {
    const year = await this.activeYear();
    if (!year) return { academic_year: null, sections: [] };
    const sections = [];
    for (const band of SCHOOL_BANDS) {
      const { classes, teachers } = await this.teachersFor(year.id, band.key);
      sections.push({
        key: band.key,
        label: band.label,
        class_count: classes.length,
        classes: classes.map((c) => c.label),
        teacher_count: teachers.length,
        submitted_count: teachers.reduce((n, t) => n + t.submitted_count, 0),
      });
    }
    return { academic_year: year, sections };
  }

  async sectionTeachers(band: SchoolBand) {
    const year = await this.activeYear();
    const meta = SCHOOL_BANDS.find((b) => b.key === band);
    if (!meta) throw new NotFoundException('Unknown section');
    if (!year) return { academic_year: null, section: meta, teachers: [] };
    const { teachers } = await this.teachersFor(year.id, band);
    return { academic_year: year, section: meta, teachers };
  }

  /** A teacher's submitted assessments, optionally limited to one section. */
  async teacherAssessments(teacherId: number, band?: SchoolBand) {
    const users: any[] = await this.db.query(
      `SELECT id, name, email, avatar FROM users WHERE id = $1 AND role = 'teacher'`,
      [teacherId],
    );
    if (!users.length) throw new NotFoundException('Teacher not found');
    const year = await this.activeYear();
    if (!year) return { teacher: users[0], assessments: [] };

    let classes = await this.yearClasses(year.id);
    if (band) classes = classes.filter((c) => c.band === band);
    const classIds = classes.map((c) => c.id);
    if (!classIds.length) return { teacher: users[0], assessments: [] };

    const rows: any[] = await this.db.query(
      `SELECT a.id, a.title, a.date::text AS date, a.max_score, a.submitted_at, a.class_id,
              c.name AS class_name, pl.name AS p_level_name,
              s.name AS subject_name, ty.category, t.name AS term_name, t.id AS term_id,
              (SELECT COUNT(*)::int FROM assessment_scores sc
                 WHERE sc.assessment_id = a.id AND sc.score IS NOT NULL) AS marked,
              (SELECT COUNT(*)::int FROM assessment_scores sc
                 WHERE sc.assessment_id = a.id AND sc.is_absent) AS absent,
              (SELECT AVG(sc.score) FROM assessment_scores sc
                 WHERE sc.assessment_id = a.id AND sc.score IS NOT NULL) AS average
       FROM assessments a
       JOIN classes c   ON c.id = a.class_id
       JOIN p_levels pl ON pl.id = c.p_level_id
       JOIN subjects s  ON s.id = a.subject_id
       JOIN assessment_types ty ON ty.id = a.assessment_type_id
       JOIN terms t     ON t.id = a.term_id
       WHERE a.status = 'submitted' AND a.created_by = $1 AND a.class_id = ANY($2)
       ORDER BY a.submitted_at DESC NULLS LAST, a.id DESC`,
      [teacherId, classIds],
    );
    return {
      teacher: users[0],
      assessments: rows.map((r) => {
        const max = Number(r.max_score);
        const average = r.average === null ? null : Number(r.average);
        return {
          ...r,
          max_score: max,
          class_label: `${r.p_level_name}${r.class_name}`,
          average: average === null ? null : Math.round(average * 10) / 10,
          average_percentage: average === null || max <= 0 ? null : Math.round((average / max) * 1000) / 10,
        };
      }),
    };
  }
}
