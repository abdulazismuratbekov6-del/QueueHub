import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { toUserDto } from "../common/utils/user-mapper";

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

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

  async setAvatar(userId: string, buffer: Buffer, contentType: string, extension: string) {
    const current = await this.prisma.user.findUnique({ where: { id: userId } });

    const { publicUrl } = await this.storage.uploadAvatar(userId, buffer, contentType, extension);

    if (current?.avatarUrl) {
      await this.storage.removeAvatarByUrl(current.avatarUrl);
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: publicUrl },
    });
    return toUserDto(user);
  }

  async removeAvatar(userId: string) {
    const current = await this.prisma.user.findUnique({ where: { id: userId } });
    if (current?.avatarUrl) {
      await this.storage.removeAvatarByUrl(current.avatarUrl);
    }
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
    });
    return toUserDto(user);
  }
}
