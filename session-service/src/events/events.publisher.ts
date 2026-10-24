import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { Room } from "../rooms/entities/room.entity";

// Estos eventos (session.room.ready, session.completed) no tienen
// consumidor en esta entrega, pero se publican tal como especifica la
// sección 4.4 del documento, para mantener el contrato de integración
// documentado en la tabla de la sección 5.11.
@Injectable()
export class EventsPublisher implements OnModuleInit {
  private readonly logger = new Logger(EventsPublisher.name);

  constructor(@Inject("SESSION_EVENTS_CLIENT") private readonly client: ClientProxy, 
              @Inject("ANALYTICS_EVENTS_CLIENT") private readonly analyticsClient: ClientProxy,
             ) {}

  async onModuleInit() {
    await this.client.connect();
    await this.analyticsClient.connect();
  }

  publishSessionRoomReady(room: Room) {
    this.logger.log(`Publicando session.room.ready para room ${room.id}`);
    return this.client.emit("session.room.ready", {
      eventName: "session.room.ready",
      occurredAt: new Date().toISOString(),
      data: { roomId: room.id, bookingId: room.booking_id },
    });
  }

  publishSessionCompleted(room: Room) {
  this.logger.log(`Publicando session.completed para room ${room.id}`);
  const payload = {
    eventName: "session.completed",
    occurredAt: new Date().toISOString(),
    data: {
      roomId: room.id,
      bookingId: room.booking_id,
      durationMinutes: room.duration_minutes,
    },
  };
  this.client.emit("session.completed", payload);
  return this.analyticsClient.emit("session.completed", payload);
    }
}
