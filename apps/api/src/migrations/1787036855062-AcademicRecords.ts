import { MigrationInterface, QueryRunner } from "typeorm";

export class AcademicRecords1787036855062 implements MigrationInterface {
    name = 'AcademicRecords1787036855062'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "assessment_scores" ("id" SERIAL NOT NULL, "assessment_id" integer NOT NULL, "student_id" integer NOT NULL, "score" numeric(6,2), "is_absent" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "assessmentId" integer, "studentId" integer, CONSTRAINT "UQ_211fa45c0c3fb251de051cbe26e" UNIQUE ("assessment_id", "student_id"), CONSTRAINT "PK_e4ff9a378c0bffd01452253a5da" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_3960c2c632d88420fed7f03b68" ON "assessment_scores" ("assessment_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_97d545921f6ab8cb00af6fe1e0" ON "assessment_scores" ("student_id") `);
        await queryRunner.query(`CREATE TYPE "public"."assessment_types_status_enum" AS ENUM('active', 'inactive')`);
        await queryRunner.query(`CREATE TABLE "assessment_types" ("id" SERIAL NOT NULL, "academic_year_id" integer NOT NULL, "name" character varying(60) NOT NULL, "weight" numeric(5,2) NOT NULL, "display_order" integer NOT NULL DEFAULT '0', "status" "public"."assessment_types_status_enum" NOT NULL DEFAULT 'active', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "academicYearId" integer, CONSTRAINT "UQ_9b8e0a8b7d7b2f34757bf9bfb79" UNIQUE ("academic_year_id", "name"), CONSTRAINT "PK_c68dcca280f0794de3fe381e578" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_b76d3bf9d4d5f3ee64bde6d32c" ON "assessment_types" ("academic_year_id") `);
        await queryRunner.query(`CREATE TYPE "public"."subjects_status_enum" AS ENUM('active', 'inactive')`);
        await queryRunner.query(`CREATE TABLE "subjects" ("id" SERIAL NOT NULL, "p_level_id" integer NOT NULL, "name" character varying(80) NOT NULL, "code" character varying(16) NOT NULL, "display_order" integer NOT NULL DEFAULT '0', "status" "public"."subjects_status_enum" NOT NULL DEFAULT 'active', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "pLevelId" integer, CONSTRAINT "UQ_56a363324fffbe09dc7b6c78d68" UNIQUE ("p_level_id", "code"), CONSTRAINT "PK_1a023685ac2b051b4e557b0b280" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_4a407c92856760a88d98785059" ON "subjects" ("p_level_id") `);
        await queryRunner.query(`CREATE TYPE "public"."terms_status_enum" AS ENUM('upcoming', 'active', 'closed')`);
        await queryRunner.query(`CREATE TABLE "terms" ("id" SERIAL NOT NULL, "academic_year_id" integer NOT NULL, "name" character varying(40) NOT NULL, "sequence" integer NOT NULL, "start_date" date NOT NULL, "end_date" date NOT NULL, "status" "public"."terms_status_enum" NOT NULL DEFAULT 'upcoming', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "academicYearId" integer, CONSTRAINT "UQ_2eee7ca669d2cbb8394e7947b42" UNIQUE ("academic_year_id", "sequence"), CONSTRAINT "PK_33b6fe77d6ace7ff43cc8a65958" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_733590da28e000d72a406ff95a" ON "terms" ("academic_year_id") `);
        await queryRunner.query(`CREATE TYPE "public"."assessments_status_enum" AS ENUM('draft', 'submitted')`);
        await queryRunner.query(`CREATE TABLE "assessments" ("id" SERIAL NOT NULL, "class_id" integer NOT NULL, "subject_id" integer NOT NULL, "assessment_type_id" integer NOT NULL, "term_id" integer NOT NULL, "title" character varying(120) NOT NULL, "date" date NOT NULL, "max_score" numeric(6,2) NOT NULL, "status" "public"."assessments_status_enum" NOT NULL DEFAULT 'draft', "submitted_at" TIMESTAMP, "created_by" integer NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "classId" integer, "subjectId" integer, "assessmentTypeId" integer, "termId" integer, "createdByUserId" integer, CONSTRAINT "PK_a3442bd80a00e9111cefca57f6c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_34452fc8e5440f1fbbb077e4c5" ON "assessments" ("class_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_195f0eb9f292448680919a9e5e" ON "assessments" ("subject_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_6810d31dcf1c7c6da400bc8aa5" ON "assessments" ("assessment_type_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_0fc9facafe432c9a5fcb6a00d4" ON "assessments" ("term_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_cba2d07506cc7a2033cb6b6b13" ON "assessments" ("created_by") `);
        await queryRunner.query(`ALTER TABLE "notifications" ADD "link" text`);
        await queryRunner.query(`ALTER TABLE "assessment_scores" ADD CONSTRAINT "FK_202c6ce6c9674b81d692b632df2" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "assessment_scores" ADD CONSTRAINT "FK_7145e3781f30550639fdc4cbc78" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "assessment_types" ADD CONSTRAINT "FK_8bff155463e4b8b51388f409cf8" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "subjects" ADD CONSTRAINT "FK_f1e8d42d6ae78f02bd99a71851f" FOREIGN KEY ("pLevelId") REFERENCES "p_levels"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "terms" ADD CONSTRAINT "FK_e47d1cc89d00b393a59aed32b08" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "assessments" ADD CONSTRAINT "FK_b4f3db3ac8ac27cfb43c70572bd" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "assessments" ADD CONSTRAINT "FK_3d790fa48896e741af9462721cd" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "assessments" ADD CONSTRAINT "FK_27d15193e8bcd097f0fef939e31" FOREIGN KEY ("assessmentTypeId") REFERENCES "assessment_types"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "assessments" ADD CONSTRAINT "FK_69fa5c748abdc2d8e562c4f5b90" FOREIGN KEY ("termId") REFERENCES "terms"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "assessments" ADD CONSTRAINT "FK_7a254e471dc624c787b09b2129d" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "assessments" DROP CONSTRAINT "FK_7a254e471dc624c787b09b2129d"`);
        await queryRunner.query(`ALTER TABLE "assessments" DROP CONSTRAINT "FK_69fa5c748abdc2d8e562c4f5b90"`);
        await queryRunner.query(`ALTER TABLE "assessments" DROP CONSTRAINT "FK_27d15193e8bcd097f0fef939e31"`);
        await queryRunner.query(`ALTER TABLE "assessments" DROP CONSTRAINT "FK_3d790fa48896e741af9462721cd"`);
        await queryRunner.query(`ALTER TABLE "assessments" DROP CONSTRAINT "FK_b4f3db3ac8ac27cfb43c70572bd"`);
        await queryRunner.query(`ALTER TABLE "terms" DROP CONSTRAINT "FK_e47d1cc89d00b393a59aed32b08"`);
        await queryRunner.query(`ALTER TABLE "subjects" DROP CONSTRAINT "FK_f1e8d42d6ae78f02bd99a71851f"`);
        await queryRunner.query(`ALTER TABLE "assessment_types" DROP CONSTRAINT "FK_8bff155463e4b8b51388f409cf8"`);
        await queryRunner.query(`ALTER TABLE "assessment_scores" DROP CONSTRAINT "FK_7145e3781f30550639fdc4cbc78"`);
        await queryRunner.query(`ALTER TABLE "assessment_scores" DROP CONSTRAINT "FK_202c6ce6c9674b81d692b632df2"`);
        await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN "link"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cba2d07506cc7a2033cb6b6b13"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0fc9facafe432c9a5fcb6a00d4"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6810d31dcf1c7c6da400bc8aa5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_195f0eb9f292448680919a9e5e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_34452fc8e5440f1fbbb077e4c5"`);
        await queryRunner.query(`DROP TABLE "assessments"`);
        await queryRunner.query(`DROP TYPE "public"."assessments_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_733590da28e000d72a406ff95a"`);
        await queryRunner.query(`DROP TABLE "terms"`);
        await queryRunner.query(`DROP TYPE "public"."terms_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4a407c92856760a88d98785059"`);
        await queryRunner.query(`DROP TABLE "subjects"`);
        await queryRunner.query(`DROP TYPE "public"."subjects_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b76d3bf9d4d5f3ee64bde6d32c"`);
        await queryRunner.query(`DROP TABLE "assessment_types"`);
        await queryRunner.query(`DROP TYPE "public"."assessment_types_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_97d545921f6ab8cb00af6fe1e0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3960c2c632d88420fed7f03b68"`);
        await queryRunner.query(`DROP TABLE "assessment_scores"`);
    }

}
