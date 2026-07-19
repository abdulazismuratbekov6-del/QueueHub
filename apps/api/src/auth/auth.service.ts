import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { Role } from "@queuehub/shared";
import { PrismaService } from "../prisma/prisma.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { GuestJoinDto } from "./dto/guest.dto";
import { toUserDto } from "../common/utils/user-mapper";

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
  user: ReturnType<typeof toUserDto>;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private async issueTokens(userId: string, role: Role): Promise<Omit<AuthResult, "user">> {
    const accessToken = this.jwtService.sign(
      { sub: userId, role },
      {
        secret: process.env.JWT_ACCESS_SECRET ?? "dev-access-secret-change-me",
        expiresIn: process.env.JWT_ACCESS_TTL ?? "15m",
      },
    );

    const refreshToken = this.jwtService.sign(
      { sub: userId },
      {
        secret: process.env.JWT_REFRESH_SECRET ?? "dev-refresh-secret-change-me",
        expiresIn: process.env.JWT_REFRESH_TTL ?? "7d",
      },
    );

    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    const csrfToken = randomBytes(24).toString("hex");

    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash },
    });

    return { accessToken, refreshToken, csrfToken };
  }

  async register(dto: RegisterDto): Promise<AuthResult> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException("Пользователь с таким email уже зарегистрирован");
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        passwordHash,
        role: dto.role ?? Role.STUDENT,
      },
    });

    const tokens = await this.issueTokens(user.id, user.role as Role);
    return { ...tokens, user: toUserDto(user) };
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException("Неверный email или пароль");
    }

    const isValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException("Неверный email или пароль");
    }

    const tokens = await this.issueTokens(user.id, user.role as Role);
    return { ...tokens, user: toUserDto(user) };
  }

  async guestSession(dto: GuestJoinDto): Promise<AuthResult> {
    const user = await this.prisma.user.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: Role.GUEST,
        isGuest: true,
      },
    });

    const tokens = await this.issueTokens(user.id, user.role as Role);
    return { ...tokens, user: toUserDto(user) };
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    let payload: { sub: string };
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET ?? "dev-refresh-secret-change-me",
      });
    } catch {
      throw new UnauthorizedException("Сессия истекла, войдите заново");
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException("Сессия истекла, войдите заново");
    }

    const matches = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!matches) {
      throw new UnauthorizedException("Сессия истекла, войдите заново");
    }

    const tokens = await this.issueTokens(user.id, user.role as Role);
    return { ...tokens, user: toUserDto(user) };
  }

  async logout(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
  }
}
