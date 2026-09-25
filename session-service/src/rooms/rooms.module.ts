import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { HttpModule } from "@nestjs/axios";
import { Room } from "./entities/room.entity";
import { SessionLog } from "./entities/session-log.entity";
import { QosMetric } from "./entities/qos-metric.entity";
import { RoomsService } from "./rooms.service";
import { RoomsController } from "./rooms.controller";
import { EventsModule } from "../events/events.module";
import { DailyClient } from "./daily.client";

@Module({
  imports: [
    TypeOrmModule.forFeature([Room, SessionLog, QosMetric]),
    forwardRef(() => EventsModule),
    HttpModule,
  ],
  providers: [RoomsService, DailyClient],
  controllers: [RoomsController],
  exports: [RoomsService],
})
export class RoomsModule {}
