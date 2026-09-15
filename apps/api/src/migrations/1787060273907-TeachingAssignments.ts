import { MigrationInterface, QueryRunner } from "typeorm";

export class TeachingAssignments1787060273907 implements MigrationInterface {
    name = 'TeachingAssignments1787060273907'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "teaching_assignments" ("id" SERIAL NOT NULL, "teacher_id" integer NOT NULL, "class_id" integer NOT NULL, "subject_id" integer NOT NULL, "is_auto_generated" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "teacherId" integer, "classId" integer, "subjectId" integer, CONSTRAINT "UQ_86cdbc2c202e6d41a49ff2f903c" UNIQUE ("class_id", "subject_id"), CONSTRAINT "PK_baf0d10098561a9840957b512e0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_7eb84b6d68b1db6cc46b5fcea9" ON "teaching_assignments" ("teacher_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_f706b6623dae17c566e8a579fc" ON "teaching_assignments" ("class_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_41ec23a5853e01d7607405c4a8" ON "teaching_assignments" ("subject_id") `);
        await queryRunner.query(`ALTER TABLE "subjects" ADD "periods_per_week" integer NOT NULL DEFAULT '5'`);
        await queryRunner.query(`ALTER TABLE "subjects" ADD "min_consecutive" integer NOT NULL DEFAULT '1'`);
        await queryRunner.query(`ALTER TABLE "teaching_assignments" ADD CONSTRAINT "FK_aba532a9dfc508bdf302d27d82a" FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "teaching_assignments" ADD CONSTRAINT "FK_fe35b3882f0f904f72783e00c41" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "teaching_assignments" ADD CONSTRAINT "FK_c2fa85b53ce8db45e281d503809" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "teaching_assignments" DROP CONSTRAINT "FK_c2fa85b53ce8db45e281d503809"`);
        await queryRunner.query(`ALTER TABLE "teaching_assignments" DROP CONSTRAINT "FK_fe35b3882f0f904f72783e00c41"`);
        await queryRunner.query(`ALTER TABLE "teaching_assignments" DROP CONSTRAINT "FK_aba532a9dfc508bdf302d27d82a"`);
        await queryRunner.query(`ALTER TABLE "subjects" DROP COLUMN "min_consecutive"`);
        await queryRunner.query(`ALTER TABLE "subjects" DROP COLUMN "periods_per_week"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_41ec23a5853e01d7607405c4a8"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f706b6623dae17c566e8a579fc"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7eb84b6d68b1db6cc46b5fcea9"`);
        await queryRunner.query(`DROP TABLE "teaching_assignments"`);
    }

}
