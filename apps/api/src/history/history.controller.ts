import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { HistoryService } from "./history.service";

@UseGuards(JwtAuthGuard)
@Controller("history")
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get()
  async list(@Query("queueId") queueId: string) {
    const entries = await this.historyService.listByQueue(queueId);
    return entries.map((entry) => ({
      id: entry.id,
      queueId: entry.queueId,
      userId: entry.userId,
      action: entry.action,
      description: entry.description,
      createdAt: entry.createdAt,
      user: entry.user
        ? { id: entry.user.id, firstName: entry.user.firstName, lastName: entry.user.lastName }
        : null,
    }));
  }
}
