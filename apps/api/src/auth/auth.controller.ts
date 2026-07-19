import {
  Body,
  Controller,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { Request, Response } from "express";
import { AuthService, AuthResult } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { GuestJoinDto } from "./dto/guest.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "../common/types/authenticated-user";
import { CSRF_COOKIE, REFRESH_COOKIE, clearAuthCookies, setAuthCookies } from "../common/utils/auth-cookies";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private respond(res: Response, result: AuthResult) {
    setAuthCookies(res, result.refreshToken, result.csrfToken);
    return res.json({
      accessToken: result.accessToken,
      csrfToken: result.csrfToken,
      user: result.user,
    });
  }

  @Post("register")
  async register(@Body() dto: RegisterDto, @Res() res: Response) {
    const result = await this.authService.register(dto);
    return this.respond(res, result);
  }

  @Post("login")
  async login(@Body() dto: LoginDto, @Res() res: Response) {
    const result = await this.authService.login(dto);
    return this.respond(res, result);
  }

  @Post("guest")
  async guest(@Body() dto: GuestJoinDto, @Res() res: Response) {
    const result = await this.authService.guestSession(dto);
    return this.respond(res, result);
  }

  @Post("refresh")
  async refresh(@Req() req: Request, @Res() res: Response) {
    const refreshToken = req.cookies?.[REFRESH_COOKIE];
    const csrfCookie = req.cookies?.[CSRF_COOKIE];
    const csrfHeader = req.headers["x-csrf-token"];

    if (!refreshToken) {
      throw new UnauthorizedException("Сессия истекла, войдите заново");
    }
    if (!csrfCookie || csrfCookie !== csrfHeader) {
      throw new UnauthorizedException("Недействительный CSRF-токен");
    }

    const result = await this.authService.refresh(refreshToken);
    return this.respond(res, result);
  }

  @UseGuards(JwtAuthGuard)
  @Post("logout")
  async logout(@CurrentUser() user: AuthenticatedUser, @Res() res: Response) {
    await this.authService.logout(user.id);
    clearAuthCookies(res);
    return res.json({ success: true });
  }
}
