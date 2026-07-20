import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { HistoryAction, QueueStatus, SocketEvents } from "@queuehub/shared";
import { PrismaService } from "../prisma/prisma.service";
import { HistoryService } from "../history/history.service";
import { RealtimeGateway } from "../realtime/realtime.gateway";
import { AuthService } from "../auth/auth.service";
import { AuthenticatedUser } from "../common/types/authenticated-user";
import { JoinQueueDto } from "./dto/join-queue.dto";
import { toMemberDto } from "../common/utils/member-mapper";

@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly history: HistoryService,
    private readonly realtime: RealtimeGateway,
    private readonly authService: AuthService,
  ) {}

  async listMembers(queueId: string, search?: string) {
    const members = await this.prisma.queueMember.findMany({
      where: {
        queueId,
        leftAt: null,
        ...(search
          ? {
              OR: [
                { user: { firstName: { contains: search, mode: "insensitive" as const } } },
                { user: { lastName: { contains: search, mode: "insensitive" as const } } },
              ],
            }
          : {}),
      },
      orderBy: { position: "asc" },
      include: { user: true },
    });
    return members.map(toMemberDto);
  }

  async join(queueId: string, user: AuthenticatedUser | undefined, dto: JoinQueueDto) {
    const queue = await this.prisma.queue.findUnique({ where: { id: queueId } });
    if (!queue) {
      throw new NotFoundException("Очередь не найдена");
    }
    if (queue.status !== QueueStatus.OPEN) {
      throw new BadRequestException("Очередь закрыта");
    }

    let effectiveUser = user;
    let issuedAuth: {
      accessToken: string;
      refreshToken: string;
      csrfToken: string;
      user: AuthenticatedUser;
    } | null = null;

    if (!effectiveUser) {
      if (queue.registrationOpen) {
        throw new UnauthorizedException("Для входа в эту очередь нужно войти в аккаунт");
      }
      if (!dto.firstName) {
        throw new BadRequestException("Укажите имя, чтобы занять очередь");
      }
      const result = await this.authService.guestSession({
        firstName: dto.firstName,
        lastName: dto.lastName,
      });
      effectiveUser = {
        id: result.user.id,
        role: result.user.role,
        isGuest: true,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        email: null,
        avatarUrl: null,
      };
      issuedAuth = {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        csrfToken: result.csrfToken,
        user: result.user,
      };
    }

    const existing = await this.prisma.queueMember.findUnique({
      where: { queueId_userId: { queueId, userId: effectiveUser.id } },
    });
    if (existing && !existing.leftAt) {
      throw new ConflictException("Вы уже в этой очереди");
    }

    const maxPosition = await this.prisma.queueMember.aggregate({
      where: { queueId, leftAt: null },
      _max: { position: true },
    });
    const nextPosition = (maxPosition._max.position ?? 0) + 1;

    const member = existing
      ? await this.prisma.queueMember.update({
          where: { id: existing.id },
          data: {
            position: nextPosition,
            originalPosition: nextPosition,
            leftAt: null,
            joinedAt: new Date(),
            calledAt: null,
            completedAt: null,
          },
          include: { user: true },
        })
      : await this.prisma.queueMember.create({
          data: { queueId, userId: effectiveUser.id, position: nextPosition, originalPosition: nextPosition },
          include: { user: true },
        });

    await this.history.log(
      queueId,
      HistoryAction.JOIN,
      `${effectiveUser.firstName} присоединился(-ась) к очереди`,
      effectiveUser.id,
    );

    const memberDto = toMemberDto(member);
    this.realtime.emitToQueue(queueId, SocketEvents.MEMBER_JOINED, memberDto);

    return { member: memberDto, auth: issuedAuth };
  }

  async leave(queueId: string, user: AuthenticatedUser) {
    const member = await this.prisma.queueMember.findUnique({
      where: { queueId_userId: { queueId, userId: user.id } },
    });
    if (!member || member.leftAt) {
      throw new NotFoundException("Вы не находитесь в этой очереди");
    }

    await this.prisma.queueMember.update({
      where: { id: member.id },
      data: { leftAt: new Date() },
    });

    await this.prisma.queueMember.updateMany({
      where: { queueId, leftAt: null, position: { gt: member.position } },
      data: { position: { decrement: 1 } },
    });

    const queue = await this.prisma.queue.findUnique({ where: { id: queueId } });
    if (queue && queue.currentPosition >= member.position) {
      await this.prisma.queue.update({
        where: { id: queueId },
        data: { currentPosition: Math.max(0, queue.currentPosition - 1) },
      });
    }

    await this.history.log(
      queueId,
      HistoryAction.LEAVE,
      `${user.firstName} покинул(а) очередь`,
      user.id,
    );

    this.realtime.emitToQueue(queueId, SocketEvents.MEMBER_LEFT, { userId: user.id });
    this.realtime.emitToQueue(queueId, SocketEvents.MEMBERS_REORDERED, await this.listMembers(queueId));
  }

  async randomize(queueId: string) {
    const members = await this.prisma.queueMember.findMany({
      where: { queueId, leftAt: null },
      orderBy: { position: "asc" },
    });

    const shuffled = [...members];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    await this.prisma.$transaction(
      shuffled.map((member, index) =>
        this.prisma.queueMember.update({
          where: { id: member.id },
          data: { position: index + 1, originalPosition: index + 1 },
        }),
      ),
    );

    await this.prisma.queue.update({ where: { id: queueId }, data: { currentPosition: 0 } });

    await this.history.log(queueId, HistoryAction.RANDOMIZE, "Очередь перемешана случайным образом");

    const updated = await this.listMembers(queueId);
    this.realtime.emitToQueue(queueId, SocketEvents.QUEUE_RANDOMIZED, updated);
    return updated;
  }

  async callNext(queueId: string) {
    const queue = await this.prisma.queue.findUnique({ where: { id: queueId } });
    if (!queue) {
      throw new NotFoundException("Очередь не найдена");
    }

    if (queue.currentPosition > 0) {
      await this.prisma.queueMember.updateMany({
        where: { queueId, leftAt: null, position: queue.currentPosition },
        data: { completedAt: new Date() },
      });
    }

    let next = await this.prisma.queueMember.findFirst({
      where: { queueId, leftAt: null, position: { gt: queue.currentPosition } },
      orderBy: { position: "asc" },
      include: { user: true },
    });

    if (!next) {
      // Дошли до конца очереди — начинаем новый круг с первого участника.
      next = await this.prisma.queueMember.findFirst({
        where: { queueId, leftAt: null },
        orderBy: { position: "asc" },
        include: { user: true },
      });
      if (next) {
        await this.prisma.queueMember.updateMany({
          where: { queueId, leftAt: null },
          data: { completedAt: null },
        });
      }
    }

    if (!next) {
      throw new BadRequestException("В очереди нет участников");
    }

    await this.prisma.queueMember.update({
      where: { id: next.id },
      data: { calledAt: new Date() },
    });

    await this.prisma.queue.update({
      where: { id: queueId },
      data: { currentPosition: next.position },
    });

    await this.revertDueOneRoundSwaps(queueId, next.position);

    const memberDto = toMemberDto(next);
    this.realtime.emitToQueue(queueId, SocketEvents.NEXT_CALLED, memberDto);
    this.notifyUpcoming(queueId, next.position);

    return memberDto;
  }

  private async notifyUpcoming(queueId: string, currentPosition: number) {
    const upcoming = await this.prisma.queueMember.findMany({
      where: {
        queueId,
        leftAt: null,
        position: { gt: currentPosition, lte: currentPosition + 2 },
      },
      orderBy: { position: "asc" },
    });

    upcoming.forEach((member) => {
      this.realtime.emitToUser(member.userId, SocketEvents.YOUR_TURN_SOON, {
        queueId,
        position: member.position,
      });
    });
  }

  private async revertDueOneRoundSwaps(queueId: string, justCalledPosition: number) {
    const activeSwaps = await this.prisma.swapRequest.findMany({
      where: { queueId, status: "ACCEPTED", swapType: "ONE_ROUND", revertedAt: null },
    });

    for (const swap of activeSwaps) {
      const earliestPosition = Math.min(swap.senderPosition, swap.receiverPosition);
      if (justCalledPosition < earliestPosition) {
        continue;
      }

      await this.prisma.queueMember.updateMany({
        where: { queueId, userId: swap.senderId, leftAt: null },
        data: { position: swap.senderPosition },
      });
      await this.prisma.queueMember.updateMany({
        where: { queueId, userId: swap.receiverId, leftAt: null },
        data: { position: swap.receiverPosition },
      });
      await this.prisma.swapRequest.update({
        where: { id: swap.id },
        data: { revertedAt: new Date() },
      });

      await this.history.log(
        queueId,
        HistoryAction.SWAP_REVERT,
        "Временный обмен местами отменён после завершения круга",
      );

      this.realtime.emitToQueue(queueId, SocketEvents.SWAP_REVERTED, { swapId: swap.id });
      this.realtime.emitToQueue(queueId, SocketEvents.MEMBERS_REORDERED, await this.listMembers(queueId));
    }
  }
}
