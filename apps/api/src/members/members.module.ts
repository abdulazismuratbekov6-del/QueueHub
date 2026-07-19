import { Module } from "@nestjs/common";
import { MembersController } from "./members.controller";
import { MembersService } from "./members.service";
import { HistoryModule } from "../history/history.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [HistoryModule, RealtimeModule, AuthModule],
  controllers: [MembersController],
  providers: [MembersService],
  exports: [MembersService],
})
export class MembersModule {}
