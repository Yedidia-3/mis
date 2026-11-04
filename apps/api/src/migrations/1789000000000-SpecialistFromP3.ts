import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * P3–P6 use subject specialists. Nursery and P1–P2 keep a class teacher for
 * every subject. Existing levels are updated to match; new ones pick the model
 * from their name when created.
 */
export class SpecialistFromP31789000000000 implements MigrationInterface {
  name = 'SpecialistFromP31789000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "p_levels"
      SET "teaching_model" = 'specialist'
      WHERE regexp_replace(upper(btrim("name")), '\\s+', '', 'g') ~ '^P[3-6]$'
    `);
    await queryRunner.query(`
      UPDATE "p_levels"
      SET "teaching_model" = 'class_teacher'
      WHERE regexp_replace(upper(btrim("name")), '\\s+', '', 'g') ~ '^(N[1-3]|P[12])$'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Previous rule treated only P4–P6 as specialist.
    await queryRunner.query(`
      UPDATE "p_levels"
      SET "teaching_model" = 'class_teacher'
      WHERE regexp_replace(upper(btrim("name")), '\\s+', '', 'g') = 'P3'
    `);
  }
}
