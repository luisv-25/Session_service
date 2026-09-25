import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RoomsModule } from "./rooms/rooms.module";
import { EventsModule } from "./events/events.module";
import { Room } from "./rooms/entities/room.entity";
import { SessionLog } from "./rooms/entities/session-log.entity";
import { QosMetric } from "./rooms/entities/qos-metric.entity";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: "postgres",
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT) || 5436,
      username: process.env.DB_USER || "session_svc",
      password: process.env.DB_PASSWORD || "session_svc_pw",
      database: process.env.DB_NAME || "session_db",
      ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
      entities: [Room, SessionLog, QosMetric],
      synchronize: process.env.DB_SYNCHRONIZE !== "false", // válido para esta entrega local, igual que en el resto de servicios
    }),
    RoomsModule,
    EventsModule,
  ],
})
export class AppModule {}
