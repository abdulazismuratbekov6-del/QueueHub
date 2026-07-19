import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import * as QRCode from "qrcode";
import sanitizeHtml from "sanitize-html";
import { HistoryAction, QueueDto, QueueStatus, Role, SocketEvents } from "@queuehub/shared";
import { Queue } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { HistoryService } from "../history/history.service";
import { RealtimeGateway } from "../realtime/realtime.gateway";
import { AuthenticatedUser } from "../common/types/authenticated-user";
import { CreateQueueDto } from "./dto/create-queue.dto";
import { UpdateQueueDto } from "./dto/update-queue.dto";
import { generateRoomCode } from "../common/utils/room-code";

function frontendBaseUrl(): string {
  return (process.env.CORS_ORIGIN ?? "http://localhost:3000").split(",")[0];
}

export function toQueueDto(queue: Queue): QueueDto {
  return {
    id: queue.id,
    title: queue.title,
    subject: queue.subject,
    description: queue.description,
    roomCode: queue.roomCode,
    qrCode: queue.qrCode,
    ownerId: queue.ownerId,
    status: queue.status as QueueStatus,
    randomEnabled: queue.randomEnabled,
    registrationOpen: queue.registrationOpen,
    timerSeconds: queue.timerSeconds,
    currentPosition: queue.currentPosition,
    createdAt: queue.createdAt.toISOString(),
  };
}

@Injectable()
export class QueuesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly history: HistoryService,
    private readonly realtime: RealtimeGateway,
  ) {}

  private async generateUniqueRoomCode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const code = generateRoomCode();
      const existing = await this.prisma.queue.findUnique({ where: { roomCode: code } });
      if (!existing) {
        return code;
      }
    }
    throw new Error("Не удалось сгенерировать уникальный код комнаты");
  }

  async create(owner: AuthenticatedUser, dto: CreateQueueDto): Promise<QueueDto> {
    const roomCode = await this.generateUniqueRoomCode();
    const joinUrl = `${frontendBaseUrl()}/q/${roomCode}`;
    const qrCode = await QRCode.toDataURL(joinUrl);

    const queue = await this.prisma.queue.create({
      data: {
        title: dto.title,
        subject: dto.subject,
        description: dto.description ? sanitizeHtml(dto.description, { allowedTags: [] }) : null,
        roomCode,
        qrCode,
        ownerId: owner.id,
        randomEnabled: dto.randomEnabled ?? false,
        registrationOpen: dto.registrationOpen ?? true,
        timerSeconds: dto.timerSeconds,
      },
    });

    return toQueueDto(queue);
  }

  async findMine(owner: AuthenticatedUser): Promise<QueueDto[]> {
    const queues = await this.prisma.queue.findMany({
      where: { ownerId: owner.id },
      orderBy: { createdAt: "desc" },
    });
    return queues.map(toQueueDto);
  }

  async findByRoomCode(roomCode: string): Promise<QueueDto> {
    const queue = await this.prisma.queue.findUnique({ where: { roomCode } });
    if (!queue) {
      throw new NotFoundException("Очередь с таким кодом не найдена");
    }
    return toQueueDto(queue);
  }

  async findById(id: string): Promise<QueueDto> {
    const queue = await this.prisma.queue.findUnique({ where: { id } });
    if (!queue) {
      throw new NotFoundException("Очередь не найдена");
    }
    return toQueueDto(queue);
  }

  async getOwnedQueueOrThrow(id: string, user: AuthenticatedUser) {
    const queue = await this.prisma.queue.findUnique({ where: { id } });
    if (!queue) {
      throw new NotFoundException("Очередь не найдена");
    }
    if (queue.ownerId !== user.id && user.role !== Role.ADMIN) {
      throw new ForbiddenException("Это не ваша очередь");
    }
    return queue;
  }

  async update(id: string, user: AuthenticatedUser, dto: UpdateQueueDto): Promise<QueueDto> {
    await this.getOwnedQueueOrThrow(id, user);
    const queue = await this.prisma.queue.update({
      where: { id },
      data: {
        ...dto,
        description:
          dto.description !== undefined
            ? sanitizeHtml(dto.description, { allowedTags: [] })
            : undefined,
      },
    });
    return toQueueDto(queue);
  }

  async setStatus(id: string, user: AuthenticatedUser, status: QueueStatus): Promise<QueueDto> {
    await this.getOwnedQueueOrThrow(id, user);
    const queue = await this.prisma.queue.update({ where: { id }, data: { status } });

    const action = status === QueueStatus.OPEN ? HistoryAction.QUEUE_OPEN : HistoryAction.QUEUE_CLOSE;
    const description =
      status === QueueStatus.OPEN ? "Очередь открыта" : "Очередь закрыта";
    await this.history.log(id, action, description, user.id);

    const event = status === QueueStatus.OPEN ? SocketEvents.QUEUE_OPENED : SocketEvents.QUEUE_CLOSED;
    this.realtime.emitToQueue(id, event, toQueueDto(queue));

    return toQueueDto(queue);
  }

  async remove(id: string, user: AuthenticatedUser): Promise<void> {
    await this.getOwnedQueueOrThrow(id, user);
    await this.prisma.queue.delete({ where: { id } });
  }
}
