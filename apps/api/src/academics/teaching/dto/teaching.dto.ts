import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayUnique, IsArray, IsInt, IsOptional, Max, Min, ValidateNested,
} from 'class-validator';

const ID_MAX = 2147483647;
const ID_MSG = 'must be a whole number above 0';

/** Subjects a teacher takes in one class. Empty subject_ids clears that class for them. */
export class ClassSubjectAssignmentDto {
  @Type(() => Number)
  @IsInt({ message: `class_id ${ID_MSG}` })
  @Min(1, { message: `class_id ${ID_MSG}` })
  @Max(ID_MAX, { message: `class_id ${ID_MSG}` })
  class_id: number;

  @IsArray()
  @ArrayMaxSize(40)
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true, message: `each subject_id ${ID_MSG}` })
  @Min(1, { each: true, message: `each subject_id ${ID_MSG}` })
  @Max(ID_MAX, { each: true, message: `each subject_id ${ID_MSG}` })
  subject_ids: number[];
}

/** One class at a time — kept for callers that already use it. */
export class AssignSubjectsDto {
  @Type(() => Number)
  @IsInt({ message: `teacher_id ${ID_MSG}` })
  @Min(1, { message: `teacher_id ${ID_MSG}` })
  @Max(ID_MAX, { message: `teacher_id ${ID_MSG}` })
  teacher_id: number;

  @Type(() => Number)
  @IsInt({ message: `class_id ${ID_MSG}` })
  @Min(1, { message: `class_id ${ID_MSG}` })
  @Max(ID_MAX, { message: `class_id ${ID_MSG}` })
  class_id: number;

  @IsArray()
  @ArrayMaxSize(40)
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true, message: `each subject_id ${ID_MSG}` })
  @Min(1, { each: true, message: `each subject_id ${ID_MSG}` })
  @Max(ID_MAX, { each: true, message: `each subject_id ${ID_MSG}` })
  subject_ids: number[];
}

/**
 * Assign a teacher across several classes in one save — the usual case when
 * someone teaches the same course in P4 and P5, or several classes at one level.
 */
export class AssignBatchDto {
  @Type(() => Number)
  @IsInt({ message: `teacher_id ${ID_MSG}` })
  @Min(1, { message: `teacher_id ${ID_MSG}` })
  @Max(ID_MAX, { message: `teacher_id ${ID_MSG}` })
  teacher_id: number;

  @IsArray()
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => ClassSubjectAssignmentDto)
  assignments: ClassSubjectAssignmentDto[];
}

export class TeachingYearQueryDto {
  @Type(() => Number)
  @IsInt({ message: `academic_year_id ${ID_MSG}` })
  @Min(1, { message: `academic_year_id ${ID_MSG}` })
  @Max(ID_MAX, { message: `academic_year_id ${ID_MSG}` })
  academic_year_id: number;
}

export class TeachingYearOptionalQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: `academic_year_id ${ID_MSG}` })
  @Min(1, { message: `academic_year_id ${ID_MSG}` })
  @Max(ID_MAX, { message: `academic_year_id ${ID_MSG}` })
  academic_year_id?: number;
}
