import { Type } from 'class-transformer';
import {
  IsArray, IsBoolean, IsDateString, IsInt, IsNumber, IsOptional, IsString,
  MaxLength, Min, ValidateNested,
} from 'class-validator';

export class CreateAssessmentDto {
  @IsInt()
  class_id: number;

  @IsInt()
  subject_id: number;

  @IsInt()
  assessment_type_id: number;

  @IsInt()
  term_id: number;

  @IsString()
  @MaxLength(120)
  title: string;

  @IsDateString()
  date: string;

  // Guarded above zero: an assessment out of nothing has no meaningful
  // percentage, and the grade calculator would have to discard it silently.
  @IsNumber()
  @Min(0.01)
  max_score: number;
}

export class UpdateAssessmentDto {
  @IsOptional()
  @IsInt()
  subject_id?: number;

  @IsOptional()
  @IsInt()
  assessment_type_id?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  max_score?: number;
}

export class ScoreEntryDto {
  @IsInt()
  student_id: number;

  // Null means the mark has not been entered yet. Absence is is_absent, which
  // is a deliberate statement rather than a gap.
  @IsOptional()
  @IsNumber()
  @Min(0)
  score?: number | null;

  @IsOptional()
  @IsBoolean()
  is_absent?: boolean;
}

export class SaveScoresDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScoreEntryDto)
  scores: ScoreEntryDto[];
}
