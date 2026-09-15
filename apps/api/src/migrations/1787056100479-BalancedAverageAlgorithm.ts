import { MigrationInterface, QueryRunner } from "typeorm";

export class BalancedAverageAlgorithm1787056100479 implements MigrationInterface {
    name = 'BalancedAverageAlgorithm1787056100479'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."shuffle_sessions_algorithm_enum" RENAME TO "shuffle_sessions_algorithm_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."shuffle_sessions_algorithm_enum" AS ENUM('balanced_average', 'round_robin', 'balanced_bands', 'snake_draft', 'auto_promote')`);
        await queryRunner.query(`ALTER TABLE "shuffle_sessions" ALTER COLUMN "algorithm" TYPE "public"."shuffle_sessions_algorithm_enum" USING "algorithm"::"text"::"public"."shuffle_sessions_algorithm_enum"`);
        await queryRunner.query(`DROP TYPE "public"."shuffle_sessions_algorithm_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."shuffle_sessions_algorithm_enum_old" AS ENUM('round_robin', 'balanced_bands', 'snake_draft', 'auto_promote')`);
        await queryRunner.query(`ALTER TABLE "shuffle_sessions" ALTER COLUMN "algorithm" TYPE "public"."shuffle_sessions_algorithm_enum_old" USING "algorithm"::"text"::"public"."shuffle_sessions_algorithm_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."shuffle_sessions_algorithm_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."shuffle_sessions_algorithm_enum_old" RENAME TO "shuffle_sessions_algorithm_enum"`);
    }

}
