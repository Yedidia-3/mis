import {
  IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min,
} from 'class-validator';

// ─── Terms ───────────────────────────────────────────────────────────────────

export class CreateTermDto {
  @IsInt()
  academic_year_id: number;

  @IsString()
  @MaxLength(40)
  name: string;

  @IsInt()
  @Min(1)
  @Max(12)
  sequence: number;

  @IsDateString()
  start_date: string;

  @IsDateString()
  end_date: string;
}

export class UpdateTermDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  name?: string;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;

  @IsOptional()
  @IsEnum(['upcoming', 'active', 'closed'])
  status?: 'upcoming' | 'active' | 'closed';
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
