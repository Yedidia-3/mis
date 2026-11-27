import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString,
  Length, Matches, Max, Min, ValidateBy, ValidateNested, ValidationOptions,
} from 'class-validator';
import { ASSESSMENT_CATEGORIES, AssessmentCategory } from '../../../entities/assessment-type.entity';
import { NUMBER_OPTS, NormaliseText, RULES, isRealDate } from './input-rules';

export function IsRealDate(options?: ValidationOptions) {
  return ValidateBy(
    {
      name: 'isRealDate',
      validator: {
        validate: (value: unknown) => typeof value === 'string' && isRealDate(value),
        defaultMessage: () => 'date must be a real calendar date written as YYYY-MM-DD',
      },
    },
    options,
  );
}

const TITLE_MESSAGE =
  'title may only contain letters, numbers, spaces and . , \' ( ) - / & : #, and must start with a letter or number';

export class CreateAssessmentDto {
  @IsInt()
  @Min(1)
  @Max(RULES.ID_MAX)
  class_id: number;

  @IsInt()
  @Min(1)
  @Max(RULES.ID_MAX)
  subject_id: number;

  // Teachers choose a category; the API resolves it to the year's assessment type.
  @IsIn(ASSESSMENT_CATEGORIES, { message: 'category must be quiz, homework or exam' })
  category: AssessmentCategory;

  @IsInt()
  @Min(1)
  @Max(RULES.ID_MAX)
  term_id: number;

  @NormaliseText()
  @IsString()
  @Length(RULES.TITLE_MIN, RULES.TITLE_MAX)
  @Matches(RULES.TITLE_PATTERN, { message: TITLE_MESSAGE })
  title: string;

  @IsString()
  @IsRealDate()
  date: string;

  @IsNumber(NUMBER_OPTS, { message: 'max_score must be a number with at most 2 decimal places' })
  @Min(RULES.MAX_SCORE_MIN)
  @Max(RULES.MAX_SCORE_MAX)
  max_score: number;
}

export class UpdateAssessmentDto {
  @IsOptional()
  @IsIn(ASSESSMENT_CATEGORIES, { message: 'category must be quiz, homework or exam' })
  category?: AssessmentCategory;

  @IsOptional()
  @NormaliseText()
  @IsString()
  @Length(RULES.TITLE_MIN, RULES.TITLE_MAX)
  @Matches(RULES.TITLE_PATTERN, { message: TITLE_MESSAGE })
  title?: string;

  @IsOptional()
  @IsString()
  @IsRealDate()
  date?: string;

  @IsOptional()
  @IsNumber(NUMBER_OPTS, { message: 'max_score must be a number with at most 2 decimal places' })
  @Min(RULES.MAX_SCORE_MIN)
  @Max(RULES.MAX_SCORE_MAX)
  max_score?: number;
}

export class ScoreEntryDto {
  @IsInt()
  @Min(1)
  @Max(RULES.ID_MAX)
  student_id: number;

  // Null means the mark has not been entered yet. Absence is is_absent, which
  // is a deliberate statement rather than a gap.
  @IsOptional()
  @IsNumber(NUMBER_OPTS, { message: 'score must be a number with at most 2 decimal places' })
  @Min(RULES.SCORE_MIN)
  @Max(RULES.SCORE_MAX)
  score?: number | null;

  @IsOptional()
  @IsBoolean()
  is_absent?: boolean;
}

export class RecordingScoreDto {
  @IsInt()
  @Min(1)
  @Max(RULES.ID_MAX)
  student_id: number;

  @IsInt()
  @Min(1)
  @Max(RULES.ID_MAX)
  subject_id: number;

  @IsOptional()
  @IsNumber(NUMBER_OPTS, { message: 'A mark must be a number with at most 2 decimal places' })
  @Min(0)
  @Max(RULES.SCORE_MAX)
  score?: number | null;
}

export class RecordingRatingDto {
  @IsInt()
  @Min(1)
  @Max(RULES.ID_MAX)
  student_id: number;

  @IsString()
  @Length(1, 32)
  subject_code: string;

  @IsOptional()
  @IsIn(['excellent', 'tres_bon', 'bon', 'assez_bon'])
  rating?: 'excellent' | 'tres_bon' | 'bon' | 'assez_bon' | null;
}

export class RecordingObservationDto {
  @IsInt()
  @Min(1)
  @Max(RULES.ID_MAX)
  student_id: number;

  @IsOptional()
  @IsString()
  @Length(0, 100)
  observation?: string | null;
}

export class RecordingDecisionDto {
  @IsInt()
  @Min(1)
  @Max(RULES.ID_MAX)
  student_id: number;

  @IsOptional()
  @IsIn(['promu', 'redoublement', 'renvoye'])
  decision?: 'promu' | 'redoublement' | 'renvoye' | null;
}

export class SubmitMidtermDto {
  @IsInt()
  @Min(1)
  @Max(RULES.ID_MAX)
  class_id: number;

  @IsInt()
  @Min(1)
  @Max(RULES.ID_MAX)
  term_id: number;

  @IsInt()
  @Min(1)
  @Max(RULES.ID_MAX)
  subject_id: number;
}

export class SaveRecordingDto {
  @IsInt()
  @Min(1)
  @Max(RULES.ID_MAX)
  class_id: number;

  @IsInt()
  @Min(1)
  @Max(RULES.ID_MAX)
  term_id: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => RecordingScoreDto)
  scores?: RecordingScoreDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => RecordingRatingDto)
  ratings?: RecordingRatingDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(400)
  @ValidateNested({ each: true })
  @Type(() => RecordingObservationDto)
  observations?: RecordingObservationDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(400)
  @ValidateNested({ each: true })
  @Type(() => RecordingDecisionDto)
  decisions?: RecordingDecisionDto[];
}

export class SaveScoresDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(RULES.ROSTER_MAX)
  @ValidateNested({ each: true })
  @Type(() => ScoreEntryDto)
  scores: ScoreEntryDto[];
}
