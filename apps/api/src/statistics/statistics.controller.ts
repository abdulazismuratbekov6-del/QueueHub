import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { StatisticsService } from "./statistics.service";

@UseGuards(JwtAuthGuard)
@Controller("statistics")
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get()
  get(@Query("queueId") queueId: string) {
    return this.statisticsService.get(queueId);
  }
}
