import { IsEnum, IsNumber } from 'class-validator';

export class RunShuffleDto {
  @IsNumber()
  p_level_id: number;

  @IsNumber()
  academic_year_id: number;

  // balanced_average is the school's default: it equalises each class's
  // average mark. The others are kept for deans who want a specific pattern.
  @IsEnum(['balanced_average', 'round_robin', 'balanced_bands', 'snake_draft', 'auto_promote'])
  algorithm: string;
}
