import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";
import { QueueStatus, Role } from "@queuehub/shared";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "../common/types/authenticated-user";
import { QueuesService } from "./queues.service";
import { CreateQueueDto } from "./dto/create-queue.dto";
import { UpdateQueueDto } from "./dto/update-queue.dto";
import { MembersService } from "../members/members.service";
import { TimerService } from "./timer.service";

class SetStatusDto {
  @IsIn([QueueStatus.OPEN, QueueStatus.CLOSED])
  status!: QueueStatus;
}

class StartTimerDto {
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(3600)
  seconds?: number;
}

@Controller("queues")
export class QueuesController {
  constructor(
    private readonly queuesService: QueuesService,
    private readonly membersService: MembersService,
    private readonly timerService: TimerService,
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateQueueDto) {
    return this.queuesService.create(user, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @Get("mine")
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.queuesService.findMine(user);
  }

  @Get("room/:roomCode")
  findByRoomCode(@Param("roomCode") roomCode: string) {
    return this.queuesService.findByRoomCode(roomCode);
  }

  @Get(":id")
  findById(@Param("id") id: string) {
    return this.queuesService.findById(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @Patch(":id")
  update(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateQueueDto,
  ) {
    return this.queuesService.update(id, user, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @Patch(":id/status")
  setStatus(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SetStatusDto,
  ) {
    return this.queuesService.setStatus(id, user, dto.status);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.queuesService.remove(id, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @Post(":id/randomize")
  async randomize(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.queuesService.getOwnedQueueOrThrow(id, user);
    return this.membersService.randomize(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @Post(":id/call-next")
  async callNext(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.queuesService.getOwnedQueueOrThrow(id, user);
    return this.membersService.callNext(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @Post(":id/timer/start")
  async startTimer(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: StartTimerDto,
  ) {
    await this.queuesService.getOwnedQueueOrThrow(id, user);
    await this.timerService.start(id, dto.seconds);
    return { running: true };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @Post(":id/timer/stop")
  async stopTimer(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.queuesService.getOwnedQueueOrThrow(id, user);
    this.timerService.stop(id);
    return { running: false };
  }
}
