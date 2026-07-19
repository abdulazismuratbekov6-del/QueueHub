import { QueueMember, User } from "@prisma/client";
import { QueueMemberDto } from "@queuehub/shared";
import { toUserDto } from "./user-mapper";

export function toMemberDto(member: QueueMember & { user: User }): QueueMemberDto {
  return {
    id: member.id,
    queueId: member.queueId,
    position: member.position,
    originalPosition: member.originalPosition,
    joinedAt: member.joinedAt.toISOString(),
    leftAt: member.leftAt ? member.leftAt.toISOString() : null,
    user: toUserDto(member.user),
  };
}
