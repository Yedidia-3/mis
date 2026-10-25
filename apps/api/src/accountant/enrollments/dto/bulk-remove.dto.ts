import { ArrayNotEmpty, IsArray, IsNumber } from 'class-validator';

export class BulkRemoveEnrollmentsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsNumber({}, { each: true })
  ids: number[];
}
