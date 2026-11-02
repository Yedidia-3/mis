import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The dean opens and closes terms. One term per academic year is open at a
 * time, and marks can only be written while their term is open.
 */
export class TermControl1788900000000 implements MigrationInterface {
  name = 'TermControl1788900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // If a year somehow has several open terms, the latest stays open and the
    // earlier ones are closed, so the unique index below can be built.
    await queryRunner.query(`
      UPDATE "terms" t SET "status" = 'closed'
      WHERE t."status" = 'active'
        AND EXISTS (
          SELECT 1 FROM "terms" later
          WHERE later."academic_year_id" = t."academic_year_id"
            AND later."status" = 'active' AND later."sequence" > t."sequence"
        )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_terms_one_open_per_year"
        ON "terms" ("academic_year_id") WHERE "status" = 'active'
    `);
    await queryRunner.query(`
      ALTER TABLE "terms"
        ADD CONSTRAINT "chk_terms_dates" CHECK ("end_date" >= "start_date") NOT VALID
    `);

    // Inserts and updates only: deletes cascade legitimately from removing a
    // student or class, and the API already refuses teacher deletes.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION "assessments_term_open"() RETURNS trigger AS $$
      DECLARE t_status text; t_name text;
      BEGIN
        SELECT status::text, name INTO t_status, t_name FROM terms WHERE id = NEW.term_id;
        IF FOUND AND t_status <> 'active' THEN
          RAISE EXCEPTION '% is not open for marks', t_name USING ERRCODE = 'check_violation';
        END IF;
        IF TG_OP = 'UPDATE' AND NEW.term_id <> OLD.term_id THEN
          RAISE EXCEPTION 'An assessment cannot move to another term' USING ERRCODE = 'check_violation';
        END IF;
        RETURN NEW;
      END $$ LANGUAGE plpgsql
    `);
    await queryRunner.query(`DROP TRIGGER IF EXISTS "trg_assessments_term_open" ON "assessments"`);
    await queryRunner.query(`
      CREATE TRIGGER "trg_assessments_term_open"
        BEFORE INSERT OR UPDATE ON "assessments"
        FOR EACH ROW EXECUTE FUNCTION "assessments_term_open"()
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION "assessment_scores_term_open"() RETURNS trigger AS $$
      DECLARE t_status text; t_name text;
      BEGIN
        SELECT t.status::text, t.name INTO t_status, t_name
          FROM assessments a JOIN terms t ON t.id = a.term_id
          WHERE a.id = NEW.assessment_id;
        IF FOUND AND t_status <> 'active' THEN
          RAISE EXCEPTION '% is not open for marks', t_name USING ERRCODE = 'check_violation';
        END IF;
        RETURN NEW;
      END $$ LANGUAGE plpgsql
    `);
    await queryRunner.query(`DROP TRIGGER IF EXISTS "trg_assessment_scores_term_open" ON "assessment_scores"`);
    await queryRunner.query(`
      CREATE TRIGGER "trg_assessment_scores_term_open"
        BEFORE INSERT OR UPDATE ON "assessment_scores"
        FOR EACH ROW EXECUTE FUNCTION "assessment_scores_term_open"()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS "trg_assessment_scores_term_open" ON "assessment_scores"`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS "assessment_scores_term_open"()`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS "trg_assessments_term_open" ON "assessments"`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS "assessments_term_open"()`);
    await queryRunner.query(`ALTER TABLE "terms" DROP CONSTRAINT IF EXISTS "chk_terms_dates"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_terms_one_open_per_year"`);
  }
}
