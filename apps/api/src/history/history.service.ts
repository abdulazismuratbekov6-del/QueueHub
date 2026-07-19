import { Injectable } from "@nestjs/common";
import { HistoryAction } from "@queuehub/shared";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class HistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async log(queueId: string, action: HistoryAction, description: string, userId?: string | null) {
    return this.prisma.historyEntry.create({
      data: {
        queueId,
        userId: userId ?? null,
        action,
        description,
      },
    });
  }

  async listByQueue(queueId: string) {
    return this.prisma.historyEntry.findMany({
      where: { queueId },
      orderBy: { createdAt: "desc" },
      include: {
        user: true,
      },
    });
  }
}
