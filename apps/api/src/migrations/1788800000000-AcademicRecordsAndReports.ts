import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Teacher mark recording, the dean's academic records and report generation.
 *
 * Constraints are added NOT VALID: they bind every row written from now on
 * without failing the deploy over a historical row nobody can fix in place.
 */
export class AcademicRecordsAndReports1788800000000 implements MigrationInterface {
  name = 'AcademicRecordsAndReports1788800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "assessment_types_category_enum" AS ENUM ('quiz', 'homework', 'exam');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
    await queryRunner.query(`
      ALTER TABLE "assessment_types"
        ADD COLUMN IF NOT EXISTS "category" "assessment_types_category_enum"
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_assessment_types_year_category"
        ON "assessment_types" ("academic_year_id", "category")
        WHERE "category" IS NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "subjects"
        ADD COLUMN IF NOT EXISTS "report_max" numeric(6,2),
        ADD COLUMN IF NOT EXISTS "report_group" character varying(40)
    `);
    await queryRunner.query(`
      ALTER TABLE "subjects"
        ADD CONSTRAINT "chk_subjects_report_max"
        CHECK ("report_max" IS NULL OR ("report_max" > 0 AND "report_max" <= 500)) NOT VALID
    `);

    await queryRunner.query(`
      ALTER TABLE "assessments"
        ADD CONSTRAINT "chk_assessments_max_score"
        CHECK ("max_score" > 0 AND "max_score" <= 1000) NOT VALID
    `);
    await queryRunner.query(`
      ALTER TABLE "assessments"
        ADD CONSTRAINT "chk_assessments_title"
        CHECK (char_length(btrim("title")) BETWEEN 2 AND 120) NOT VALID
    `);
    await queryRunner.query(`
      ALTER TABLE "assessment_scores"
        ADD CONSTRAINT "chk_assessment_scores_score"
        CHECK ("score" IS NULL OR ("score" >= 0 AND "score" <= 1000)) NOT VALID
    `);
    await queryRunner.query(`
      ALTER TABLE "assessment_scores"
        ADD CONSTRAINT "chk_assessment_scores_absent"
        CHECK (NOT ("is_absent" AND "score" IS NOT NULL)) NOT VALID
    `);

    // A CHECK cannot see the parent row, so the ceiling is a trigger.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION "assessment_scores_within_max"() RETURNS trigger AS $$
      DECLARE ceiling numeric;
      BEGIN
        IF NEW.score IS NULL THEN RETURN NEW; END IF;
        SELECT max_score INTO ceiling FROM assessments WHERE id = NEW.assessment_id;
        IF ceiling IS NOT NULL AND NEW.score > ceiling THEN
          RAISE EXCEPTION 'Score % exceeds the maximum of %', NEW.score, ceiling
            USING ERRCODE = 'check_violation';
        END IF;
        RETURN NEW;
      END $$ LANGUAGE plpgsql
    `);
    await queryRunner.query(`DROP TRIGGER IF EXISTS "trg_assessment_scores_within_max" ON "assessment_scores"`);
    await queryRunner.query(`
      CREATE TRIGGER "trg_assessment_scores_within_max"
        BEFORE INSERT OR UPDATE ON "assessment_scores"
        FOR EACH ROW EXECUTE FUNCTION "assessment_scores_within_max"()
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "report_cards_kind_enum" AS ENUM ('mid_term', 'end_of_term', 'end_of_year');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "report_cards" (
        "id" SERIAL PRIMARY KEY,
        "student_id" integer NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
        "class_id" integer REFERENCES "classes"("id") ON DELETE SET NULL,
        "academic_year_id" integer NOT NULL REFERENCES "academic_years"("id") ON DELETE CASCADE,
        "term_id" integer REFERENCES "terms"("id") ON DELETE CASCADE,
        "kind" "report_cards_kind_enum" NOT NULL,
        "payload" jsonb NOT NULL,
        "flagged_count" integer NOT NULL DEFAULT 0,
        "total" numeric(8,2),
        "max_total" numeric(8,2),
        "percentage" numeric(5,2),
        "position" integer,
        "class_size" integer,
        "generated_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
        "generated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "chk_report_cards_term" CHECK (("kind" = 'end_of_year') = ("term_id" IS NULL)),
        CONSTRAINT "chk_report_cards_percentage" CHECK ("percentage" IS NULL OR ("percentage" >= 0 AND "percentage" <= 100))
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_report_cards_student_kind_period"
        ON "report_cards" ("student_id", "kind", "academic_year_id", COALESCE("term_id", 0))
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_report_cards_class" ON "report_cards" ("class_id", "kind")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "report_cards"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "report_cards_kind_enum"`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS "trg_assessment_scores_within_max" ON "assessment_scores"`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS "assessment_scores_within_max"()`);
    await queryRunner.query(`ALTER TABLE "assessment_scores" DROP CONSTRAINT IF EXISTS "chk_assessment_scores_absent"`);
    await queryRunner.query(`ALTER TABLE "assessment_scores" DROP CONSTRAINT IF EXISTS "chk_assessment_scores_score"`);
    await queryRunner.query(`ALTER TABLE "assessments" DROP CONSTRAINT IF EXISTS "chk_assessments_title"`);
    await queryRunner.query(`ALTER TABLE "assessments" DROP CONSTRAINT IF EXISTS "chk_assessments_max_score"`);
    await queryRunner.query(`ALTER TABLE "subjects" DROP CONSTRAINT IF EXISTS "chk_subjects_report_max"`);
    await queryRunner.query(`ALTER TABLE "subjects" DROP COLUMN IF EXISTS "report_group"`);
    await queryRunner.query(`ALTER TABLE "subjects" DROP COLUMN IF EXISTS "report_max"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_assessment_types_year_category"`);
    await queryRunner.query(`ALTER TABLE "assessment_types" DROP COLUMN IF EXISTS "category"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "assessment_types_category_enum"`);
  }
}
