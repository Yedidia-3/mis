import { IsEmail, IsEnum, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  name: string;

  @IsString()
  @MinLength(9)
  @MaxLength(20)
  phone: string;

  @IsEmail()
  email: string;

  @IsEnum(['dean', 'principal', 'teacher', 'accountant'])
  role: string;
}
