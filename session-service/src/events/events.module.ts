import { Module, forwardRef } from "@nestjs/common";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { EventsPublisher } from "./events.publisher";
import { BookingConfirmedConsumer } from "./booking-confirmed.consumer";
import { RoomsModule } from "../rooms/rooms.module";

@Module({
  imports: [
    forwardRef(() => RoomsModule),
    ClientsModule.register([
      {
        name: "SESSION_EVENTS_CLIENT",
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672"],
          queue: "session_events_queue",
          queueOptions: { durable: true },
        },
      },
      {
        name: "ANALYTICS_EVENTS_CLIENT",
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672"],
          queue: "session_analytics_queue",
          queueOptions: { durable: true },
        },
      },
    ]),
  ],
  providers: [EventsPublisher],
  controllers: [BookingConfirmedConsumer],
  exports: [EventsPublisher],
})
export class EventsModule {}
