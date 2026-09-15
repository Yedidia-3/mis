import { IsDateString, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateEnrollmentDto {
  @IsNumber()
  student_id: number;

  @IsEnum(['feeding', 'transport'])
  type: 'feeding' | 'transport';

  @IsOptional()
  @IsEnum(['breakfast', 'lunch', 'both'])
  meal_type?: 'breakfast' | 'lunch' | 'both';

  @IsOptional()
  @IsNumber()
  zone_id?: number;

  @IsDateString()
  payment_date: string;

  @IsNumber()
  duration_days: number;
}
