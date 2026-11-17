
import { Controller, Inject, Logger, forwardRef } from "@nestjs/common";
import { Ctx, EventPattern, Payload, RmqContext } from "@nestjs/microservices";
import { RoomsService } from "../rooms/rooms.service";

interface BookingEvent {
  eventName: string;
  occurredAt: string;
  data: { bookingId: string };
}

@Controller()
export class BookingConfirmedConsumer {
  private readonly logger = new Logger(BookingConfirmedConsumer.name);

  constructor(
    @Inject(forwardRef(() => RoomsService))
    private readonly roomsService: RoomsService,
  ) {}

  @EventPattern("booking.confirmed")
  async handleBookingConfirmed(
    @Payload() event: BookingEvent,
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

  // Cierra automáticamente la sala cuando Booking cancela la reserva.
  @EventPattern("booking.cancelled")
  async handleBookingCancelled(
    @Payload() event: BookingEvent,
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    try {
      await this.roomsService.cancelForBooking(event.data.bookingId);

      this.logger.log(
        `Reserva ${event.data.bookingId} cancelada: sala procesada`,
      );

      channel.ack(originalMsg);
    } catch (err) {
      this.logger.error("Error procesando booking.cancelled", err as Error);
      channel.nack(originalMsg, false, true);
    }
  }
}
