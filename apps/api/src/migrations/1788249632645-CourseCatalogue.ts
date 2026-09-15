import { MigrationInterface, QueryRunner } from "typeorm";

export class CourseCatalogue1788249632645 implements MigrationInterface {
    name = 'CourseCatalogue1788249632645'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."course_catalogue_status_enum" AS ENUM('active', 'inactive')`);
        await queryRunner.query(`CREATE TABLE "course_catalogue" ("id" SERIAL NOT NULL, "name" character varying(80) NOT NULL, "code" character varying(16) NOT NULL, "default_periods_per_week" integer NOT NULL DEFAULT '5', "default_min_consecutive" integer NOT NULL DEFAULT '1', "status" "public"."course_catalogue_status_enum" NOT NULL DEFAULT 'active', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_bc3a8583b18312a58707070ce42" UNIQUE ("code"), CONSTRAINT "PK_803ba6f9787c38afd6f685ff679" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "subjects" ADD "catalogue_id" integer`);
        await queryRunner.query(`ALTER TABLE "subjects" ADD CONSTRAINT "FK_43033b7ef3c65dbee0f660c71f6" FOREIGN KEY ("catalogue_id") REFERENCES "course_catalogue"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "subjects" DROP CONSTRAINT "FK_43033b7ef3c65dbee0f660c71f6"`);
        await queryRunner.query(`ALTER TABLE "subjects" DROP COLUMN "catalogue_id"`);
        await queryRunner.query(`DROP TABLE "course_catalogue"`);
        await queryRunner.query(`DROP TYPE "public"."course_catalogue_status_enum"`);
    }

}
