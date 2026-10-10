import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class LoginDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  login?: string;

  // Keep accepting email for users created before login names were added.
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @MinLength(1)
  password!: string;
}
