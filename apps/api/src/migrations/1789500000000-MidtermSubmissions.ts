import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * One submission per class, lesson and term. Teachers save drafts freely, then
 * submit the lesson sheet to the dean when the mid-term marks are ready.
 */
export class MidtermSubmissions1789500000000 implements MigrationInterface {
  name = 'MidtermSubmissions1789500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "midterm_submissions" (
        "id" SERIAL PRIMARY KEY,
        "class_id" integer NOT NULL REFERENCES "classes"("id") ON DELETE CASCADE,
        "subject_id" integer NOT NULL REFERENCES "subjects"("id") ON DELETE CASCADE,
        "term_id" integer NOT NULL REFERENCES "terms"("id") ON DELETE CASCADE,
        "submitted_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
        "submitted_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "uq_midterm_submissions" UNIQUE ("class_id", "subject_id", "term_id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_midterm_submissions_term"
        ON "midterm_submissions" ("term_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_midterm_submissions_teacher"
        ON "midterm_submissions" ("submitted_by")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "midterm_submissions"`);
  }
}
