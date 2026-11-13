import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserPhone1789200000000 implements MigrationInterface {
  name = 'UserPhone1789200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" character varying(20)`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "users_phone_unique" ON "users" ("phone") WHERE "phone" IS NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "users_phone_unique"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "phone"`);
  }
}
