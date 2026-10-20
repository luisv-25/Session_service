import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { RoomsService } from "./rooms.service";

@Controller("sessions")
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get("booking/:bookingId")
  findByBooking(@Param("bookingId") bookingId: string) {
    return this.roomsService.findByBooking(bookingId);
  }

  // Comunicación síncrona entrante: content-service resuelve session_id ->
  // booking_id (sección 5.7 del documento) para saber quién es el
  // estudiante/tutor inscrito a esa sesión antes de aceptar un archivo o
  // autorizar su descarga. Mismo criterio "sin guard" que el resto de los
  // endpoints de este controlador (llamadas servidor-a-servidor, igual que
  // UserServiceClient/CatalogServiceClient en los demás microservicios).
  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.roomsService.findOne(id);
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
