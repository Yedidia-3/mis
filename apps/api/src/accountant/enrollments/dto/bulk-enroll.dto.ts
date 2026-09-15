import { ArrayNotEmpty, IsArray, IsEnum, IsNumber, IsOptional } from 'class-validator';

// Importing a class into a service is a membership action — no payment yet.
// The accountant ticks the monthly B/L boxes afterwards in the grid.
export class BulkEnrollDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsNumber({}, { each: true })
  student_ids: number[];

  @IsEnum(['feeding', 'transport'])
  type: 'feeding' | 'transport';

  @IsOptional()
  @IsNumber()
  zone_id?: number;
}
