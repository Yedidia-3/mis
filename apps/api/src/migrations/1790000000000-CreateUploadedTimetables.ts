import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUploadedTimetables1790000000000 implements MigrationInterface {
  name = 'CreateUploadedTimetables1790000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "uploaded_timetables" (
      "id" SERIAL PRIMARY KEY,
      "name" character varying,
      "academic_year_id" integer,
      "uploaded_by" integer,
      "data" jsonb NOT NULL,
      "created_at" TIMESTAMPTZ DEFAULT now()
    )`);

    await queryRunner.query(`ALTER TABLE "uploaded_timetables" ADD CONSTRAINT "fk_uploaded_timetables_academic_year" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"(id) ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE "uploaded_timetables" ADD CONSTRAINT "fk_uploaded_timetables_uploaded_by" FOREIGN KEY ("uploaded_by") REFERENCES "users"(id) ON DELETE SET NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "uploaded_timetables" DROP CONSTRAINT IF EXISTS "fk_uploaded_timetables_uploaded_by"`);
    await queryRunner.query(`ALTER TABLE "uploaded_timetables" DROP CONSTRAINT IF EXISTS "fk_uploaded_timetables_academic_year"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "uploaded_timetables"`);
  }
}
