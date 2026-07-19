import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "../common/types/authenticated-user";
import { SwapService } from "./swap.service";
import { CreateSwapDto, RespondSwapDto } from "./dto/create-swap.dto";

@UseGuards(JwtAuthGuard)
@Controller("swap")
export class SwapController {
  constructor(private readonly swapService: SwapService) {}

  @Get("incoming")
  incoming(@CurrentUser() user: AuthenticatedUser) {
    return this.swapService.listIncoming(user);
  }

  @Post("request")
  request(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSwapDto) {
    return this.swapService.request(user, dto);
  }

  @Post("accept")
  accept(@CurrentUser() user: AuthenticatedUser, @Body() dto: RespondSwapDto) {
    return this.swapService.accept(dto.swapRequestId, user);
  }

  @Post("reject")
  reject(@CurrentUser() user: AuthenticatedUser, @Body() dto: RespondSwapDto) {
    return this.swapService.reject(dto.swapRequestId, user);
  }
}
