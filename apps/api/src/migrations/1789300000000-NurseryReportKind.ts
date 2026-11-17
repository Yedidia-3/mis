import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the nursery bulletin to the report kind. Enum values cannot be used in
 * the same transaction that adds them, so the check constraint moves in the
 * following migration. This one runs outside a transaction.
 */
export class NurseryReportKind1789300000000 implements MigrationInterface {
  name = 'NurseryReportKind1789300000000';
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    const existing = await queryRunner.query(
      `SELECT 1 FROM pg_enum e
       JOIN pg_type t ON t.oid = e.enumtypid
       WHERE t.typname = 'report_cards_kind_enum' AND e.enumlabel = 'nursery'`,
    );
    if (!existing.length) {
      await queryRunner.query(`ALTER TYPE "report_cards_kind_enum" ADD VALUE 'nursery'`);
    }
  }

  public async down(): Promise<void> {
    // PostgreSQL cannot drop a single enum value. The label stays.
  }
}
