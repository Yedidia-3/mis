import { MigrationInterface, QueryRunner } from 'typeorm';

export class AuditLogTargets1788700000000 implements MigrationInterface {
  name = 'AuditLogTargets1788700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
        ADD COLUMN IF NOT EXISTS "target_type" character varying,
        ADD COLUMN IF NOT EXISTS "target_id" integer,
        ADD COLUMN IF NOT EXISTS "target_name" character varying
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
        DROP COLUMN IF EXISTS "target_name",
        DROP COLUMN IF EXISTS "target_id",
        DROP COLUMN IF EXISTS "target_type"
    `);
  }
}
