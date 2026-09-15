import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropTimetableTables1694540000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop legacy timetable tables if they exist
    await queryRunner.query(`DROP TABLE IF EXISTS timetable_slots CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS timetable_plans CASCADE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No-op down migration: restoring old schema is manual
  }
}
