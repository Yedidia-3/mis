import { IsNumber, IsOptional } from 'class-validator';

export class AcceptRosterDto {
  @IsOptional()
  @IsNumber()
  notification_id?: number;
}
