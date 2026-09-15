import { IsNumber, IsString } from 'class-validator';

export class CreatePLevelDto {
  @IsString()
  name: string;

  @IsNumber()
  academic_year_id: number;
}
