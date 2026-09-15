import { MigrationInterface, QueryRunner } from "typeorm";

export class DropDuplicateForeignKeyColumns1787061056167 implements MigrationInterface {
    name = 'DropDuplicateForeignKeyColumns1787061056167'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "assessment_scores" DROP CONSTRAINT "FK_202c6ce6c9674b81d692b632df2"`);
        await queryRunner.query(`ALTER TABLE "assessment_scores" DROP CONSTRAINT "FK_7145e3781f30550639fdc4cbc78"`);
        await queryRunner.query(`ALTER TABLE "assessment_types" DROP CONSTRAINT "FK_8bff155463e4b8b51388f409cf8"`);
        await queryRunner.query(`ALTER TABLE "subjects" DROP CONSTRAINT "FK_f1e8d42d6ae78f02bd99a71851f"`);
        await queryRunner.query(`ALTER TABLE "terms" DROP CONSTRAINT "FK_e47d1cc89d00b393a59aed32b08"`);
        await queryRunner.query(`ALTER TABLE "assessments" DROP CONSTRAINT "FK_b4f3db3ac8ac27cfb43c70572bd"`);
        await queryRunner.query(`ALTER TABLE "assessments" DROP CONSTRAINT "FK_3d790fa48896e741af9462721cd"`);
        await queryRunner.query(`ALTER TABLE "assessments" DROP CONSTRAINT "FK_27d15193e8bcd097f0fef939e31"`);
        await queryRunner.query(`ALTER TABLE "assessments" DROP CONSTRAINT "FK_69fa5c748abdc2d8e562c4f5b90"`);
        await queryRunner.query(`ALTER TABLE "assessments" DROP CONSTRAINT "FK_7a254e471dc624c787b09b2129d"`);
        await queryRunner.query(`ALTER TABLE "teaching_assignments" DROP CONSTRAINT "FK_aba532a9dfc508bdf302d27d82a"`);
        await queryRunner.query(`ALTER TABLE "teaching_assignments" DROP CONSTRAINT "FK_fe35b3882f0f904f72783e00c41"`);
        await queryRunner.query(`ALTER TABLE "teaching_assignments" DROP CONSTRAINT "FK_c2fa85b53ce8db45e281d503809"`);
        await queryRunner.query(`ALTER TABLE "assessment_scores" DROP COLUMN "assessmentId"`);
        await queryRunner.query(`ALTER TABLE "assessment_scores" DROP COLUMN "studentId"`);
        await queryRunner.query(`ALTER TABLE "assessment_types" DROP COLUMN "academicYearId"`);
        await queryRunner.query(`ALTER TABLE "subjects" DROP COLUMN "pLevelId"`);
        await queryRunner.query(`ALTER TABLE "terms" DROP COLUMN "academicYearId"`);
        await queryRunner.query(`ALTER TABLE "assessments" DROP COLUMN "classId"`);
        await queryRunner.query(`ALTER TABLE "assessments" DROP COLUMN "subjectId"`);
        await queryRunner.query(`ALTER TABLE "assessments" DROP COLUMN "assessmentTypeId"`);
        await queryRunner.query(`ALTER TABLE "assessments" DROP COLUMN "termId"`);
        await queryRunner.query(`ALTER TABLE "assessments" DROP COLUMN "createdByUserId"`);
        await queryRunner.query(`ALTER TABLE "teaching_assignments" DROP COLUMN "subjectId"`);
        await queryRunner.query(`ALTER TABLE "teaching_assignments" DROP COLUMN "teacherId"`);
        await queryRunner.query(`ALTER TABLE "teaching_assignments" DROP COLUMN "classId"`);
        await queryRunner.query(`ALTER TABLE "assessment_scores" ADD CONSTRAINT "FK_3960c2c632d88420fed7f03b683" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "assessment_scores" ADD CONSTRAINT "FK_97d545921f6ab8cb00af6fe1e02" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "assessment_types" ADD CONSTRAINT "FK_b76d3bf9d4d5f3ee64bde6d32c3" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "subjects" ADD CONSTRAINT "FK_4a407c92856760a88d987850595" FOREIGN KEY ("p_level_id") REFERENCES "p_levels"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "terms" ADD CONSTRAINT "FK_733590da28e000d72a406ff95a9" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "assessments" ADD CONSTRAINT "FK_34452fc8e5440f1fbbb077e4c56" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "assessments" ADD CONSTRAINT "FK_195f0eb9f292448680919a9e5e9" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "assessments" ADD CONSTRAINT "FK_6810d31dcf1c7c6da400bc8aa52" FOREIGN KEY ("assessment_type_id") REFERENCES "assessment_types"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "assessments" ADD CONSTRAINT "FK_0fc9facafe432c9a5fcb6a00d47" FOREIGN KEY ("term_id") REFERENCES "terms"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "assessments" ADD CONSTRAINT "FK_cba2d07506cc7a2033cb6b6b130" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "teaching_assignments" ADD CONSTRAINT "FK_7eb84b6d68b1db6cc46b5fcea98" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "teaching_assignments" ADD CONSTRAINT "FK_f706b6623dae17c566e8a579fc0" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "teaching_assignments" ADD CONSTRAINT "FK_41ec23a5853e01d7607405c4a8e" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "teaching_assignments" DROP CONSTRAINT "FK_41ec23a5853e01d7607405c4a8e"`);
        await queryRunner.query(`ALTER TABLE "teaching_assignments" DROP CONSTRAINT "FK_f706b6623dae17c566e8a579fc0"`);
        await queryRunner.query(`ALTER TABLE "teaching_assignments" DROP CONSTRAINT "FK_7eb84b6d68b1db6cc46b5fcea98"`);
        await queryRunner.query(`ALTER TABLE "assessments" DROP CONSTRAINT "FK_cba2d07506cc7a2033cb6b6b130"`);
        await queryRunner.query(`ALTER TABLE "assessments" DROP CONSTRAINT "FK_0fc9facafe432c9a5fcb6a00d47"`);
        await queryRunner.query(`ALTER TABLE "assessments" DROP CONSTRAINT "FK_6810d31dcf1c7c6da400bc8aa52"`);
        await queryRunner.query(`ALTER TABLE "assessments" DROP CONSTRAINT "FK_195f0eb9f292448680919a9e5e9"`);
        await queryRunner.query(`ALTER TABLE "assessments" DROP CONSTRAINT "FK_34452fc8e5440f1fbbb077e4c56"`);
        await queryRunner.query(`ALTER TABLE "terms" DROP CONSTRAINT "FK_733590da28e000d72a406ff95a9"`);
        await queryRunner.query(`ALTER TABLE "subjects" DROP CONSTRAINT "FK_4a407c92856760a88d987850595"`);
        await queryRunner.query(`ALTER TABLE "assessment_types" DROP CONSTRAINT "FK_b76d3bf9d4d5f3ee64bde6d32c3"`);
        await queryRunner.query(`ALTER TABLE "assessment_scores" DROP CONSTRAINT "FK_97d545921f6ab8cb00af6fe1e02"`);
        await queryRunner.query(`ALTER TABLE "assessment_scores" DROP CONSTRAINT "FK_3960c2c632d88420fed7f03b683"`);
        await queryRunner.query(`ALTER TABLE "teaching_assignments" ADD "classId" integer`);
        await queryRunner.query(`ALTER TABLE "teaching_assignments" ADD "teacherId" integer`);
        await queryRunner.query(`ALTER TABLE "teaching_assignments" ADD "subjectId" integer`);
        await queryRunner.query(`ALTER TABLE "assessments" ADD "createdByUserId" integer`);
        await queryRunner.query(`ALTER TABLE "assessments" ADD "termId" integer`);
        await queryRunner.query(`ALTER TABLE "assessments" ADD "assessmentTypeId" integer`);
        await queryRunner.query(`ALTER TABLE "assessments" ADD "subjectId" integer`);
        await queryRunner.query(`ALTER TABLE "assessments" ADD "classId" integer`);
        await queryRunner.query(`ALTER TABLE "terms" ADD "academicYearId" integer`);
        await queryRunner.query(`ALTER TABLE "subjects" ADD "pLevelId" integer`);
        await queryRunner.query(`ALTER TABLE "assessment_types" ADD "academicYearId" integer`);
        await queryRunner.query(`ALTER TABLE "assessment_scores" ADD "studentId" integer`);
        await queryRunner.query(`ALTER TABLE "assessment_scores" ADD "assessmentId" integer`);
        await queryRunner.query(`ALTER TABLE "teaching_assignments" ADD CONSTRAINT "FK_c2fa85b53ce8db45e281d503809" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "teaching_assignments" ADD CONSTRAINT "FK_fe35b3882f0f904f72783e00c41" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "teaching_assignments" ADD CONSTRAINT "FK_aba532a9dfc508bdf302d27d82a" FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "assessments" ADD CONSTRAINT "FK_7a254e471dc624c787b09b2129d" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "assessments" ADD CONSTRAINT "FK_69fa5c748abdc2d8e562c4f5b90" FOREIGN KEY ("termId") REFERENCES "terms"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "assessments" ADD CONSTRAINT "FK_27d15193e8bcd097f0fef939e31" FOREIGN KEY ("assessmentTypeId") REFERENCES "assessment_types"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "assessments" ADD CONSTRAINT "FK_3d790fa48896e741af9462721cd" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "assessments" ADD CONSTRAINT "FK_b4f3db3ac8ac27cfb43c70572bd" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "terms" ADD CONSTRAINT "FK_e47d1cc89d00b393a59aed32b08" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "subjects" ADD CONSTRAINT "FK_f1e8d42d6ae78f02bd99a71851f" FOREIGN KEY ("pLevelId") REFERENCES "p_levels"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "assessment_types" ADD CONSTRAINT "FK_8bff155463e4b8b51388f409cf8" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "assessment_scores" ADD CONSTRAINT "FK_7145e3781f30550639fdc4cbc78" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "assessment_scores" ADD CONSTRAINT "FK_202c6ce6c9674b81d692b632df2" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
