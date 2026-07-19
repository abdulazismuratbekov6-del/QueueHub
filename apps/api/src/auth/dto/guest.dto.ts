import { IsOptional, IsString, MinLength } from "class-validator";

export class GuestJoinDto {
  @IsString()
  @MinLength(1)
  firstName!: string;

  @IsOptional()
  @IsString()
  lastName?: string;
}
