import { Type } from 'class-transformer';
import { IsNumber, Min } from 'class-validator';

export class SetFeedingPricesDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  breakfast: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  lunch: number;
}
