import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { RoomsService } from "./rooms.service";

@Controller("sessions")
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get("booking/:bookingId")
  findByBooking(@Param("bookingId") bookingId: string) {
    return this.roomsService.findByBooking(bookingId);
  }

  @Get(":id/token")
  getToken(@Param("id") id: string) {
    return this.roomsService.getToken(id);
  }

  @Patch(":id/end")
  end(@Param("id") id: string) {
    return this.roomsService.end(id);
  }

  @Get(":id/logs")
  listLogs(@Param("id") id: string) {
    return this.roomsService.listLogs(id);
  }

  @Post(":id/qos-samples")
  recordQos(@Param("id") id: string, @Body() body: { jitterMs?: number; packetLossPct?: number }) {
    return this.roomsService.recordQosSample(id, body);
  }

  @Get(":id/qos-samples")
  listQos(@Param("id") id: string) {
    return this.roomsService.listQos(id);
  }
}
