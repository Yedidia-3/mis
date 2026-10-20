import { MigrationInterface, QueryRunner } from 'typeorm';

export class FeedingPrices1788500000000 implements MigrationInterface {
  name = 'FeedingPrices1788500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "feeding_prices" (
        "id" SERIAL PRIMARY KEY,
        "breakfast" numeric(12,2) NOT NULL DEFAULT 0,
        "lunch" numeric(12,2) NOT NULL DEFAULT 0,
        "updated_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      INSERT INTO "feeding_prices" ("breakfast", "lunch")
      SELECT 0, 0
      WHERE NOT EXISTS (SELECT 1 FROM "feeding_prices")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "feeding_prices"`);
  }
}
