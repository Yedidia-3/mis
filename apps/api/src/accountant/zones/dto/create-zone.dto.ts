import { IsNumber, IsString } from 'class-validator';

export class CreateZoneDto {
  @IsString()
  name: string;

  @IsNumber()
  price: number;
}
