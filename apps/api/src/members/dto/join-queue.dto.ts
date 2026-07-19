import { IsOptional, IsString, MinLength } from "class-validator";

export class JoinQueueDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;
}
