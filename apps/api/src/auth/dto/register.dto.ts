import { IsEmail, IsIn, IsOptional, IsString, MinLength } from "class-validator";
import { Role } from "@queuehub/shared";

export class RegisterDto {
  @IsString()
  @MinLength(1)
  firstName!: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsOptional()
  @IsIn([Role.STUDENT, Role.TEACHER])
  role?: Role.STUDENT | Role.TEACHER;
}
