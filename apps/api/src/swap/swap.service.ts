import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { HistoryAction, SocketEvents, SwapRequestDto, SwapStatus } from "@queuehub/shared";
import { SwapRequest } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { HistoryService } from "../history/history.service";
import { RealtimeGateway } from "../realtime/realtime.gateway";
import { AuthenticatedUser } from "../common/types/authenticated-user";
import { CreateSwapDto } from "./dto/create-swap.dto";
import { toMemberDto } from "../common/utils/member-mapper";

function toSwapDto(swap: SwapRequest): SwapRequestDto {
  return {
    id: swap.id,
    queueId: swap.queueId,
    senderId: swap.senderId,
    receiverId: swap.receiverId,
    senderPosition: swap.senderPosition,
    receiverPosition: swap.receiverPosition,
    swapType: swap.swapType as SwapRequestDto["swapType"],
    status: swap.status as SwapRequestDto["status"],
    createdAt: swap.createdAt.toISOString(),
    acceptedAt: swap.acceptedAt ? swap.acceptedAt.toISOString() : null,
  };
}

@Injectable()
export class SwapService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly history: HistoryService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async request(sender: AuthenticatedUser, dto: CreateSwapDto): Promise<SwapRequestDto> {
    if (dto.receiverId === sender.id) {
      throw new BadRequestException("Нельзя отправить запрос обмена самому себе");
    }

    const [senderMember, receiverMember] = await Promise.all([
      this.prisma.queueMember.findUnique({
        where: { queueId_userId: { queueId: dto.queueId, userId: sender.id } },
      }),
      this.prisma.queueMember.findUnique({
        where: { queueId_userId: { queueId: dto.queueId, userId: dto.receiverId } },
      }),
    ]);

    if (!senderMember || senderMember.leftAt) {
      throw new BadRequestException("Вы не находитесь в этой очереди");
    }
    if (!receiverMember || receiverMember.leftAt) {
      throw new NotFoundException("Выбранный участник не находится в очереди");
    }

    const swap = await this.prisma.swapRequest.create({
      data: {
        queueId: dto.queueId,
        senderId: sender.id,
        receiverId: dto.receiverId,
        senderPosition: senderMember.position,
        receiverPosition: receiverMember.position,
        swapType: dto.swapType,
        status: SwapStatus.PENDING,
      },
    });

    const dtoResult = toSwapDto(swap);
    this.realtime.emitToQueue(dto.queueId, SocketEvents.SWAP_REQUESTED, dtoResult);
    this.realtime.emitToUser(dto.receiverId, SocketEvents.SWAP_REQUESTED, dtoResult);

    return dtoResult;
  }

  async listIncoming(user: AuthenticatedUser): Promise<SwapRequestDto[]> {
    const swaps = await this.prisma.swapRequest.findMany({
      where: { receiverId: user.id, status: SwapStatus.PENDING },
      orderBy: { createdAt: "desc" },
    });
    return swaps.map(toSwapDto);
  }

  private async getPendingForReceiver(swapRequestId: string, user: AuthenticatedUser) {
    const swap = await this.prisma.swapRequest.findUnique({ where: { id: swapRequestId } });
    if (!swap) {
      throw new NotFoundException("Запрос на обмен не найден");
    }
    if (swap.receiverId !== user.id) {
      throw new ForbiddenException("Это не ваш запрос на обмен");
    }
    if (swap.status !== SwapStatus.PENDING) {
      throw new BadRequestException("Этот запрос уже обработан");
    }
    return swap;
  }

  async accept(swapRequestId: string, user: AuthenticatedUser): Promise<SwapRequestDto> {
    const swap = await this.getPendingForReceiver(swapRequestId, user);

    const [senderMember, receiverMember] = await Promise.all([
      this.prisma.queueMember.findUnique({
        where: { queueId_userId: { queueId: swap.queueId, userId: swap.senderId } },
      }),
      this.prisma.queueMember.findUnique({
        where: { queueId_userId: { queueId: swap.queueId, userId: swap.receiverId } },
      }),
    ]);

    if (!senderMember || senderMember.leftAt || !receiverMember || receiverMember.leftAt) {
      throw new BadRequestException("Один из участников уже покинул очередь");
    }

    await this.prisma.$transaction([
      this.prisma.queueMember.update({
        where: { id: senderMember.id },
        data: {
          position: receiverMember.position,
          ...(swap.swapType === "PERMANENT" ? { originalPosition: receiverMember.position } : {}),
        },
      }),
      this.prisma.queueMember.update({
        where: { id: receiverMember.id },
        data: {
          position: senderMember.position,
          ...(swap.swapType === "PERMANENT" ? { originalPosition: senderMember.position } : {}),
        },
      }),
      this.prisma.swapRequest.update({
        where: { id: swap.id },
        data: { status: SwapStatus.ACCEPTED, acceptedAt: new Date() },
      }),
    ]);

    await this.history.log(
      swap.queueId,
      HistoryAction.SWAP,
      `Обмен местами подтверждён (${swap.swapType === "ONE_ROUND" ? "один круг" : "навсегда"})`,
      user.id,
    );

    const updated = await this.prisma.swapRequest.findUniqueOrThrow({ where: { id: swap.id } });
    const dtoResult = toSwapDto(updated);
    this.realtime.emitToQueue(swap.queueId, SocketEvents.SWAP_ACCEPTED, dtoResult);

    const members = await this.prisma.queueMember.findMany({
      where: { queueId: swap.queueId, leftAt: null },
      orderBy: { position: "asc" },
      include: { user: true },
    });
    this.realtime.emitToQueue(
      swap.queueId,
      SocketEvents.MEMBERS_REORDERED,
      members.map(toMemberDto),
    );

    return dtoResult;
  }

  async reject(swapRequestId: string, user: AuthenticatedUser): Promise<SwapRequestDto> {
    const swap = await this.getPendingForReceiver(swapRequestId, user);
    const updated = await this.prisma.swapRequest.update({
      where: { id: swap.id },
      data: { status: SwapStatus.REJECTED },
    });

    const dtoResult = toSwapDto(updated);
    this.realtime.emitToQueue(swap.queueId, SocketEvents.SWAP_REJECTED, dtoResult);
    return dtoResult;
  }
}
