import { MigrationInterface, QueryRunner } from 'typeorm';

export class AccountantRoster1788600000000 implements MigrationInterface {
  name = 'AccountantRoster1788600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "notifications"
        ADD COLUMN IF NOT EXISTS "requires_action" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "action_status" character varying(20),
        ADD COLUMN IF NOT EXISTS "meta" jsonb
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "accountant_roster_students" (
        "id" SERIAL PRIMARY KEY,
        "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "academic_year_id" integer NOT NULL,
        "student_id" integer NOT NULL,
        "student_id_number" character varying(50),
        "student_name" character varying(100) NOT NULL,
        "class_id" integer,
        "class_name" character varying(20) NOT NULL,
        "p_level_id" integer,
        "p_level_name" character varying(20) NOT NULL,
        "accepted_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "uq_roster_user_year_student" UNIQUE ("user_id", "academic_year_id", "student_id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "accountant_roster_students"`);
    await queryRunner.query(`
      ALTER TABLE "notifications"
        DROP COLUMN IF EXISTS "meta",
        DROP COLUMN IF EXISTS "action_status",
        DROP COLUMN IF EXISTS "requires_action"
    `);
  }
}
