import {
  IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Length, Matches, Max, MaxLength, Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IsRealDate } from './assessment.dto';
import { NormaliseText, RULES } from './input-rules';

const TERM_NAME_MESSAGE = 'Term name may contain only letters, digits, spaces and . , \' ( ) - / & : #';

// ─── Terms ───────────────────────────────────────────────────────────────────

export class CreateTermDto {
  @IsInt()
  @Min(1)
  @Max(RULES.ID_MAX)
  academic_year_id: number;

  @NormaliseText()
  @IsString()
  @Length(2, 40)
  @Matches(RULES.TITLE_PATTERN, { message: TERM_NAME_MESSAGE })
  name: string;

  @IsInt()
  @Min(1)
  @Max(3)
  sequence: number;

  @IsRealDate()
  start_date: string;

  @IsRealDate()
  end_date: string;
}

export class UpdateTermDto {
  @IsOptional()
  @NormaliseText()
  @IsString()
  @Length(2, 40)
  @Matches(RULES.TITLE_PATTERN, { message: TERM_NAME_MESSAGE })
  name?: string;

  @IsOptional()
  @IsRealDate()
  start_date?: string;

  @IsOptional()
  @IsRealDate()
  end_date?: string;

}

const YEAR_ID_MESSAGE = 'academic_year_id must be a whole number above 0';

export class TermsOverviewQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: YEAR_ID_MESSAGE })
  @Min(1, { message: YEAR_ID_MESSAGE })
  @Max(RULES.ID_MAX, { message: YEAR_ID_MESSAGE })
  academic_year_id?: number;
}

/** A term's status moves only through the open and close actions, never through an edit. */
export class CloseTermDto {
  @IsOptional()
  @IsBoolean()
  confirm_drafts?: boolean;
}

// ─── Course catalogue ────────────────────────────────────────────────────────

export class CreateCatalogueEntryDto {
  @IsString()
  @MaxLength(80)
  name: string;

  @IsString()
  @MaxLength(16)
  code: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  default_periods_per_week?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  default_min_consecutive?: number;
}

export class UpdateCatalogueEntryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  code?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  default_periods_per_week?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  default_min_consecutive?: number;

  @IsOptional()
  @IsEnum(['active', 'inactive'])
  status?: 'active' | 'inactive';
}

export class AssignPLevelDto {
  @IsInt()
  p_level_id: number;

  @IsInt({ each: true })
  catalogue_ids: number[];
}

// ─── Subjects ────────────────────────────────────────────────────────────────

export class CreateSubjectDto {
  @IsInt()
  p_level_id: number;

  @IsString()
  @MaxLength(80)
  name: string;

  @IsString()
  @MaxLength(16)
  code: string;

  @IsOptional()
  @IsInt()
  display_order?: number;
}

export class UpdateSubjectDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  code?: string;

  @IsOptional()
  @IsInt()
  display_order?: number;

  @IsOptional()
  @IsEnum(['active', 'inactive'])
  status?: 'active' | 'inactive';
}

// ─── Assessment types (the dean-maintained placeholders) ─────────────────────

export class CreateAssessmentTypeDto {
  @IsInt()
  academic_year_id: number;

  @IsString()
  @MaxLength(60)
  name: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  weight: number;

  @IsOptional()
  @IsInt()
  display_order?: number;
}

export class UpdateAssessmentTypeDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  weight?: number;

  @IsOptional()
  @IsInt()
  display_order?: number;

  @IsOptional()
  @IsEnum(['active', 'inactive'])
  status?: 'active' | 'inactive';
}
