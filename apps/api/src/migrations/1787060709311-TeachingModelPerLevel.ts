import { MigrationInterface, QueryRunner } from "typeorm";

export class TeachingModelPerLevel1787060709311 implements MigrationInterface {
    name = 'TeachingModelPerLevel1787060709311'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."p_levels_teaching_model_enum" AS ENUM('class_teacher', 'specialist')`);
        await queryRunner.query(`ALTER TABLE "p_levels" ADD "teaching_model" "public"."p_levels_teaching_model_enum" NOT NULL DEFAULT 'class_teacher'`);
        await queryRunner.query(`ALTER TABLE "p_levels" ADD "max_periods_per_teacher" integer NOT NULL DEFAULT '30'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "p_levels" DROP COLUMN "max_periods_per_teacher"`);
        await queryRunner.query(`ALTER TABLE "p_levels" DROP COLUMN "teaching_model"`);
        await queryRunner.query(`DROP TYPE "public"."p_levels_teaching_model_enum"`);
    }

}
