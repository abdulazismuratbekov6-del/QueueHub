import { Body, Controller, Get, Param, Post, Query, Res, UseGuards } from "@nestjs/common";
import { Response } from "express";
import { OptionalJwtAuthGuard } from "../common/guards/optional-jwt-auth.guard";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "../common/types/authenticated-user";
import { MembersService } from "./members.service";
import { JoinQueueDto } from "./dto/join-queue.dto";
import { setAuthCookies } from "../common/utils/auth-cookies";

@Controller("queues")
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get(":id/members")
  list(@Param("id") id: string, @Query("search") search?: string) {
    return this.membersService.listMembers(id, search);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Post(":id/join")
  async join(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Body() dto: JoinQueueDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.membersService.join(id, user, dto);

    if (result.auth) {
      setAuthCookies(res, result.auth.refreshToken, result.auth.csrfToken);
    }

    return {
      member: result.member,
      auth: result.auth
        ? { accessToken: result.auth.accessToken, user: result.auth.user }
        : null,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post(":id/leave")
  leave(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.membersService.leave(id, user);
  }
}
