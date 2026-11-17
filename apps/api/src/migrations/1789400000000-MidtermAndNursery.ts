import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Where teachers record the two bulletins: one number per subject for a
 * mid-term, and a colour, an observation and a deliberation for nursery.
 */
export class MidtermAndNursery1789400000000 implements MigrationInterface {
  name = 'MidtermAndNursery1789400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "report_cards" DROP CONSTRAINT IF EXISTS "chk_report_cards_term"`);
    await queryRunner.query(`
      ALTER TABLE "report_cards" ADD CONSTRAINT "chk_report_cards_term" CHECK (
        (("kind" IN ('end_of_year', 'nursery')) AND "term_id" IS NULL)
        OR (("kind" IN ('mid_term', 'end_of_term')) AND "term_id" IS NOT NULL)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "midterm_scores" (
        "id" SERIAL PRIMARY KEY,
        "class_id" integer NOT NULL REFERENCES "classes"("id") ON DELETE CASCADE,
        "subject_id" integer NOT NULL REFERENCES "subjects"("id") ON DELETE CASCADE,
        "term_id" integer NOT NULL REFERENCES "terms"("id") ON DELETE CASCADE,
        "student_id" integer NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
        "score" numeric(6,2) NOT NULL,
        "updated_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "uq_midterm_scores" UNIQUE ("term_id", "student_id", "subject_id"),
        CONSTRAINT "chk_midterm_scores_score" CHECK ("score" >= 0 AND "score" <= 1000)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_midterm_scores_class_term"
        ON "midterm_scores" ("class_id", "term_id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "nursery_ratings" (
        "id" SERIAL PRIMARY KEY,
        "class_id" integer NOT NULL REFERENCES "classes"("id") ON DELETE CASCADE,
        "term_id" integer NOT NULL REFERENCES "terms"("id") ON DELETE CASCADE,
        "student_id" integer NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
        "subject_code" character varying(32) NOT NULL,
        "rating" character varying(16) NOT NULL,
        "updated_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "uq_nursery_ratings" UNIQUE ("term_id", "student_id", "subject_code"),
        CONSTRAINT "chk_nursery_rating" CHECK ("rating" IN ('excellent', 'tres_bon', 'bon', 'assez_bon'))
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_nursery_ratings_class_term"
        ON "nursery_ratings" ("class_id", "term_id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "nursery_observations" (
        "id" SERIAL PRIMARY KEY,
        "term_id" integer NOT NULL REFERENCES "terms"("id") ON DELETE CASCADE,
        "student_id" integer NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
        "observation" character varying(100) NOT NULL,
        "updated_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "uq_nursery_observations" UNIQUE ("term_id", "student_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "nursery_decisions" (
        "id" SERIAL PRIMARY KEY,
        "academic_year_id" integer NOT NULL REFERENCES "academic_years"("id") ON DELETE CASCADE,
        "student_id" integer NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
        "decision" character varying(20) NOT NULL,
        "updated_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "uq_nursery_decisions" UNIQUE ("academic_year_id", "student_id"),
        CONSTRAINT "chk_nursery_decision" CHECK ("decision" IN ('promu', 'redoublement', 'renvoye'))
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "nursery_decisions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "nursery_observations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "nursery_ratings"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "midterm_scores"`);
    await queryRunner.query(`ALTER TABLE "report_cards" DROP CONSTRAINT IF EXISTS "chk_report_cards_term"`);
    await queryRunner.query(`
      ALTER TABLE "report_cards" ADD CONSTRAINT "chk_report_cards_term"
      CHECK (("kind" = 'end_of_year') = ("term_id" IS NULL))
    `);
  }
}
