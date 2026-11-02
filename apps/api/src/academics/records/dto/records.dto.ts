import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional,
  Length, Matches, Max, Min, ValidateIf, ValidateNested,
} from 'class-validator';
import { REPORT_KINDS, ReportKind } from '../../../entities/report-card.entity';
import { NormaliseText, NUMBER_OPTS, RULES } from '../../assessments/dto/input-rules';
import { SchoolBand } from '../school-band';

const TERM_MESSAGE = { message: 'Choose a term for mid-term and end of term reports' };

const BANDS: SchoolBand[] = ['nursery', 'lower_primary', 'upper_primary'];

export class BandQueryDto {
  @IsOptional()
  @IsIn(BANDS)
  band?: SchoolBand;
}

/** Which report and which term; end of year has no term. */
export class ReportQueryDto {
  @IsIn(REPORT_KINDS)
  kind: ReportKind;

  @ValidateIf((o) => o.kind !== 'end_of_year')
  @Type(() => Number)
  @IsInt(TERM_MESSAGE)
  @Min(1, TERM_MESSAGE)
  @Max(RULES.ID_MAX, TERM_MESSAGE)
  term_id?: number;
}

export class GenerateReportsDto {
  @IsInt()
  @Min(1)
  @Max(RULES.ID_MAX)
  class_id: number;

  @IsIn(REPORT_KINDS)
  kind: ReportKind;

  @ValidateIf((o) => o.kind !== 'end_of_year')
  @IsInt(TERM_MESSAGE)
  @Min(1, TERM_MESSAGE)
  @Max(RULES.ID_MAX, TERM_MESSAGE)
  term_id?: number;

  // Omitted means the whole class.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(RULES.ROSTER_MAX)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(RULES.ID_MAX, { each: true })
  student_ids?: number[];

  // The dean has seen the flagged cells and wants to print anyway.
  @IsBoolean()
  confirm_incomplete: boolean;
}

export class SubjectReportSettingDto {
  @IsInt()
  @Min(1)
  @Max(RULES.ID_MAX)
  id: number;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsNumber(NUMBER_OPTS)
  @Min(RULES.REPORT_MAX_MIN)
  @Max(RULES.REPORT_MAX_MAX)
  report_max?: number | null;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? null : value))
  @NormaliseText()
  @ValidateIf((_, v) => v !== null)
  @Length(1, RULES.GROUP_MAX)
  @Matches(RULES.GROUP_PATTERN, {
    message: 'Group may contain only letters, spaces and . \' - &, starting with a letter',
  })
  report_group?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999)
  display_order?: number;
}

export class SaveSubjectReportSettingsDto {
  @IsArray()
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => SubjectReportSettingDto)
  subjects: SubjectReportSettingDto[];
}
