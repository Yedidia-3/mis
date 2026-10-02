import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStudentApprovalWorkflow1788400000000 implements MigrationInterface {
  name = 'AddStudentApprovalWorkflow1788400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "students" 
        ADD COLUMN IF NOT EXISTS "is_imported" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "imported_by_user_id" integer,
        ADD COLUMN IF NOT EXISTS "imported_at" TIMESTAMP,
        ADD COLUMN IF NOT EXISTS "approval_status" character varying(20) NOT NULL DEFAULT 'approved',
        ADD COLUMN IF NOT EXISTS "approved_by_user_id" integer,
        ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMP;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_students_approval_status" ON "students" ("approval_status");
      CREATE INDEX IF NOT EXISTS "idx_students_imported_by" ON "students" ("imported_by_user_id");
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_unique_p_levels_year_name" 
      ON "p_levels" ("academic_year_id", UPPER(TRIM("name"))) 
      WHERE "status" = 'active';

      CREATE UNIQUE INDEX IF NOT EXISTS "idx_unique_classes_plevel_name" 
      ON "classes" ("p_level_id", UPPER(TRIM("name"))) 
      WHERE "status" = 'active';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_unique_classes_plevel_name"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_unique_p_levels_year_name"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_students_imported_by"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_students_approval_status"`);
    await queryRunner.query(`
      ALTER TABLE "students" 
        DROP COLUMN IF EXISTS "approved_at",
        DROP COLUMN IF EXISTS "approved_by_user_id",
        DROP COLUMN IF EXISTS "approval_status",
        DROP COLUMN IF EXISTS "imported_at",
        DROP COLUMN IF EXISTS "imported_by_user_id",
        DROP COLUMN IF EXISTS "is_imported";
    `);
  }
}
