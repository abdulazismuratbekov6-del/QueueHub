import { User } from "@prisma/client";
import { UserDto } from "@queuehub/shared";

export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    avatarUrl: user.avatarUrl,
    role: user.role as UserDto["role"],
    isGuest: user.isGuest,
  };
}
