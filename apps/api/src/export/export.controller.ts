import { Controller, Get, Param, Res, UseGuards } from "@nestjs/common";
import { Response } from "express";
import { Role } from "@queuehub/shared";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "../common/types/authenticated-user";
import { ExportService } from "./export.service";
import { QueuesService } from "../queues/queues.service";

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TEACHER, Role.ADMIN)
@Controller("export")
export class ExportController {
  constructor(
    private readonly exportService: ExportService,
    private readonly queuesService: QueuesService,
  ) {}

  @Get(":queueId/pdf")
  async pdf(
    @Param("queueId") queueId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    await this.queuesService.getOwnedQueueOrThrow(queueId, user);
    await this.exportService.exportPdf(queueId, res);
  }

  @Get(":queueId/excel")
  async excel(
    @Param("queueId") queueId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    await this.queuesService.getOwnedQueueOrThrow(queueId, user);
    await this.exportService.exportExcel(queueId, res);
  }
}
