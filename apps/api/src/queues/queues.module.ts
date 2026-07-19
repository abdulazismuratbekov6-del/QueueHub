import { Module } from "@nestjs/common";
import { QueuesController } from "./queues.controller";
import { QueuesService } from "./queues.service";
import { TimerService } from "./timer.service";
import { HistoryModule } from "../history/history.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { MembersModule } from "../members/members.module";

@Module({
  imports: [HistoryModule, RealtimeModule, MembersModule],
  controllers: [QueuesController],
  providers: [QueuesService, TimerService],
  exports: [QueuesService],
})
export class QueuesModule {}
