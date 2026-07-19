import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { ProfileModule } from "./profile/profile.module";
import { HistoryModule } from "./history/history.module";
import { RealtimeModule } from "./realtime/realtime.module";
import { MembersModule } from "./members/members.module";
import { QueuesModule } from "./queues/queues.module";
import { SwapModule } from "./swap/swap.module";
import { StatisticsModule } from "./statistics/statistics.module";
import { ExportModule } from "./export/export.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 200 }]),
    PrismaModule,
    AuthModule,
    ProfileModule,
    HistoryModule,
    RealtimeModule,
    MembersModule,
    QueuesModule,
    SwapModule,
    StatisticsModule,
    ExportModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
