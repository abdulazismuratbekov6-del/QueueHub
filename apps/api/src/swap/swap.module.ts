import { Module } from "@nestjs/common";
import { SwapController } from "./swap.controller";
import { SwapService } from "./swap.service";
import { HistoryModule } from "../history/history.module";
import { RealtimeModule } from "../realtime/realtime.module";

@Module({
  imports: [HistoryModule, RealtimeModule],
  controllers: [SwapController],
  providers: [SwapService],
})
export class SwapModule {}
