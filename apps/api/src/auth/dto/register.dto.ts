import { IsEmail, IsIn, IsOptional, IsString, Matches, MinLength } from "class-validator";
import { Role } from "@queuehub/shared";

export class RegisterDto {
  @IsString()
  @MinLength(1)
  firstName!: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9_]{3,24}$/)
  username?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsIn([Role.STUDENT, Role.TEACHER])
  role?: Role.STUDENT | Role.TEACHER;
}
