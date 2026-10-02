import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStudentIdNumber1788300000000 implements MigrationInterface {
  name = 'AddStudentIdNumber1788300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "student_id_number" character varying(50)`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_students_student_id_number" ON "students" ("student_id_number")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_students_student_id_number"`);
    await queryRunner.query(`ALTER TABLE "students" DROP COLUMN IF EXISTS "student_id_number"`);
  }
}
