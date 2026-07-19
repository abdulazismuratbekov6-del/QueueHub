import { Injectable, NotFoundException } from "@nestjs/common";
import { existsSync, unlinkSync } from "fs";
import { join } from "path";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { toUserDto } from "../common/utils/user-mapper";

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  private uploadsDir() {
    return join(process.cwd(), process.env.UPLOADS_DIR ?? "./uploads", "avatars");
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("Пользователь не найден");
    }
    return toUserDto(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: dto,
    });
    return toUserDto(user);
  }

  private deleteFileIfLocal(avatarUrl: string | null) {
    if (!avatarUrl) return;
    const filename = avatarUrl.split("/uploads/avatars/")[1];
    if (!filename) return;
    const filePath = join(this.uploadsDir(), filename);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  }

  async setAvatar(userId: string, filename: string) {
    const current = await this.prisma.user.findUnique({ where: { id: userId } });
    if (current) {
      this.deleteFileIfLocal(current.avatarUrl);
    }

    const publicUrl = `${process.env.PUBLIC_API_URL ?? "http://localhost:4000"}/uploads/avatars/${filename}`;
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: publicUrl },
    });
    return toUserDto(user);
  }

  async removeAvatar(userId: string) {
    const current = await this.prisma.user.findUnique({ where: { id: userId } });
    if (current) {
      this.deleteFileIfLocal(current.avatarUrl);
    }
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
    });
    return toUserDto(user);
  }
}
