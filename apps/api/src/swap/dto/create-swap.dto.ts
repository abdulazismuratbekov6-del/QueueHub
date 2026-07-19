import { IsIn, IsUUID } from "class-validator";
import { SwapType } from "@queuehub/shared";

export class CreateSwapDto {
  @IsUUID()
  queueId!: string;

  @IsUUID()
  receiverId!: string;

  @IsIn([SwapType.ONE_ROUND, SwapType.PERMANENT])
  swapType!: SwapType;
}

export class RespondSwapDto {
  @IsUUID()
  swapRequestId!: string;
}
