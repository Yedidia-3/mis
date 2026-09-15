import { IsNumber, IsString } from 'class-validator';

export class CreateClassDto {
  @IsString()
  name: string;

  @IsNumber()
  p_level_id: number;
}
