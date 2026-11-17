import { Controller, Inject, Logger, forwardRef } from "@nestjs/common";
import { Ctx, EventPattern, Payload, RmqContext } from "@nestjs/microservices";
import { RoomsService } from "../rooms/rooms.service";

interface BookingConfirmedEvent {
  eventName: string;
  occurredAt: string;
  data: { bookingId: string };
}

@Controller()
export class BookingConfirmedConsumer {
  private readonly logger = new Logger(BookingConfirmedConsumer.name);

  constructor(
    @Inject(forwardRef(() => RoomsService)) private readonly roomsService: RoomsService,
  ) {}

  // Comunicación ASÍNCRONA: Session reacciona a booking.confirmed creando
  // la sala de videollamada (sección 4.4 del documento de arquitectura).
  @EventPattern("booking.confirmed")
  async handleBookingConfirmed(
    @Payload() event: BookingConfirmedEvent,
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();
    try {
      await this.roomsService.createForBooking(event.data.bookingId);
      channel.ack(originalMsg);
    } catch (err) {
      this.logger.error("Error procesando booking.confirmed", err as Error);
      channel.nack(originalMsg, false, true);
    }
  }
}
