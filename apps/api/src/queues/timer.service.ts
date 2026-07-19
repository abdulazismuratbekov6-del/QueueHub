import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { SocketEvents } from "@queuehub/shared";
import { RealtimeGateway } from "../realtime/realtime.gateway";
import { MembersService } from "../members/members.service";
import { PrismaService } from "../prisma/prisma.service";

interface TimerState {
  remaining: number;
  durationSeconds: number;
  interval: ReturnType<typeof setInterval>;
}

@Injectable()
export class TimerService implements OnModuleDestroy {
  private timers = new Map<string, TimerState>();

  constructor(
    private readonly realtime: RealtimeGateway,
    private readonly membersService: MembersService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleDestroy() {
    this.timers.forEach((state) => clearInterval(state.interval));
  }

  isRunning(queueId: string): boolean {
    return this.timers.has(queueId);
  }

  async start(queueId: string, seconds?: number) {
    this.stop(queueId);

    let durationSeconds = seconds;
    if (!durationSeconds) {
      const queue = await this.prisma.queue.findUnique({ where: { id: queueId } });
      durationSeconds = queue?.timerSeconds ?? 120;
    }

    this.runCountdown(queueId, durationSeconds);
  }

  private runCountdown(queueId: string, durationSeconds: number) {
    const state: TimerState = {
      remaining: durationSeconds,
      durationSeconds,
      interval: setInterval(() => this.tick(queueId), 1000),
    };
    this.timers.set(queueId, state);
    this.realtime.emitToQueue(queueId, SocketEvents.TIMER_TICK, {
      remaining: state.remaining,
      running: true,
    });
  }

  private async tick(queueId: string) {
    const state = this.timers.get(queueId);
    if (!state) return;

    state.remaining -= 1;
    this.realtime.emitToQueue(queueId, SocketEvents.TIMER_TICK, {
      remaining: state.remaining,
      running: true,
    });

    if (state.remaining <= 0) {
      clearInterval(state.interval);
      this.timers.delete(queueId);

      try {
        await this.membersService.callNext(queueId);
        this.runCountdown(queueId, state.durationSeconds);
      } catch {
        this.realtime.emitToQueue(queueId, SocketEvents.TIMER_TICK, { remaining: 0, running: false });
      }
    }
  }

  stop(queueId: string) {
    const state = this.timers.get(queueId);
    if (state) {
      clearInterval(state.interval);
      this.timers.delete(queueId);
    }
    this.realtime.emitToQueue(queueId, SocketEvents.TIMER_TICK, { remaining: 0, running: false });
  }
}
