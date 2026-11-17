import { DataSource } from 'typeorm';
import {
  BULLETIN_ORDER, BulletinCode, canonicalSubject, MIDTERM_MAXIMA, primaryYear, SUBJECT_RECORD_NAMES,
} from './bulletin';

/**
 * Makes sure every P1–P6 level has the six mid-term subjects, with the maximum
 * from the workbooks. Subjects that are not on the bulletin (Creative Arts,
 * Sport, IT) keep a blank maximum so they are not asked for.
 */
export async function ensureBulletinSubjects(db: DataSource): Promise<void> {
  const levels: { id: number; name: string }[] = await db.query(`SELECT id, name FROM p_levels`);
  for (const level of levels) {
    const year = primaryYear(level.name);
    if (!year) continue;
    const maxima = MIDTERM_MAXIMA[year];
    const rows: { id: number; name: string; code: string; status: string }[] = await db.query(
      `SELECT id, name, code, status::text AS status FROM subjects WHERE p_level_id = $1`,
      [level.id],
    );

    const byCanon = new Map<BulletinCode, { id: number; status: string }>();
    for (const row of rows) {
      const canon = canonicalSubject(row.code, row.name);
      if (!canon || byCanon.has(canon)) continue;
      byCanon.set(canon, { id: row.id, status: row.status });
    }

    const bulletinIds: number[] = [];
    let order = 1;
    for (const code of BULLETIN_ORDER) {
      const known = byCanon.get(code);
      if (known) {
        await db.query(
          `UPDATE subjects
             SET report_max = $1, display_order = $2, report_group = NULL, status = 'active'
           WHERE id = $3`,
          [maxima[code], order, known.id],
        );
        bulletinIds.push(known.id);
      } else {
        const record = SUBJECT_RECORD_NAMES[code];
        const inserted: { id: number }[] = await db.query(
          `INSERT INTO subjects
             (p_level_id, name, code, display_order, report_max, periods_per_week, min_consecutive, status, created_at, updated_at)
           SELECT $1, $2, $3, $4, $5, 5, 1, 'active', now(), now()
           WHERE NOT EXISTS (
             SELECT 1 FROM subjects WHERE p_level_id = $1 AND code = $3
           )
           RETURNING id`,
          [level.id, record.name, record.code, order, maxima[code]],
        );
        if (inserted[0]) bulletinIds.push(inserted[0].id);
        else {
          const again: { id: number }[] = await db.query(
            `SELECT id FROM subjects WHERE p_level_id = $1 AND code = $2 LIMIT 1`,
            [level.id, record.code],
          );
          if (again[0]) {
            await db.query(
              `UPDATE subjects
                 SET report_max = $1, display_order = $2, report_group = NULL, status = 'active'
               WHERE id = $3`,
              [maxima[code], order, again[0].id],
            );
            bulletinIds.push(again[0].id);
          }
        }
      }
      order += 1;
    }

    await db.query(
      `UPDATE subjects SET report_max = NULL
       WHERE p_level_id = $1 AND status = 'active' AND NOT (id = ANY($2::int[]))`,
      [level.id, bulletinIds.length ? bulletinIds : [0]],
    );
  }
}
