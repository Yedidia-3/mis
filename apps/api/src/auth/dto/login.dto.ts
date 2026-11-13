import { IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @MinLength(9)
  @MaxLength(150)
  phone: string;

  @IsString()
  @MinLength(6)
  password: string;
}
