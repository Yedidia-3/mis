import { MigrationInterface, QueryRunner } from 'typeorm';

export class ClassListSheet1789100000000 implements MigrationInterface {
  name = 'ClassListSheet1789100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "sheet" jsonb NOT NULL DEFAULT '{}'::jsonb`);
    await queryRunner.query(`ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "list_headers" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "classes" DROP COLUMN IF EXISTS "list_headers"`);
    await queryRunner.query(`ALTER TABLE "students" DROP COLUMN IF EXISTS "sheet"`);
  }
}
