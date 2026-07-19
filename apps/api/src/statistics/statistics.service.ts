import { Injectable } from "@nestjs/common";
import { QueueStatisticsDto, SwapStatus } from "@queuehub/shared";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class StatisticsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(queueId: string): Promise<QueueStatisticsDto> {
    const [totalStudents, remainingStudents, completedMembers, swapCount, leftCount] =
      await Promise.all([
        this.prisma.queueMember.count({ where: { queueId } }),
        this.prisma.queueMember.count({ where: { queueId, leftAt: null, completedAt: null } }),
        this.prisma.queueMember.findMany({
          where: { queueId, completedAt: { not: null }, calledAt: { not: null } },
          select: { calledAt: true, completedAt: true },
        }),
        this.prisma.swapRequest.count({ where: { queueId, status: SwapStatus.ACCEPTED } }),
        this.prisma.queueMember.count({ where: { queueId, leftAt: { not: null } } }),
      ]);

    const durations = completedMembers.map(
      (m) => (m.completedAt!.getTime() - m.calledAt!.getTime()) / 1000,
    );
    const averageTimeSeconds =
      durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null;

    return {
      totalStudents,
      remainingStudents,
      passedStudents: completedMembers.length,
      averageTimeSeconds,
      swapCount,
      leftCount,
    };
  }
}
