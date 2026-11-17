import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Room, RoomStatus } from "./entities/room.entity";
import { SessionLog } from "./entities/session-log.entity";
import { QosMetric } from "./entities/qos-metric.entity";
import { EventsPublisher } from "../events/events.publisher";
import { DailyClient } from "./daily.client";

@Injectable()
export class RoomsService {
  private readonly logger = new Logger(RoomsService.name);

  constructor(
    @InjectRepository(Room) private readonly roomsRepo: Repository<Room>,
    @InjectRepository(SessionLog) private readonly sessionLogsRepo: Repository<SessionLog>,
    @InjectRepository(QosMetric) private readonly qosMetricsRepo: Repository<QosMetric>,
    private readonly eventsPublisher: EventsPublisher,
    private readonly dailyClient: DailyClient,
  ) {}

  private logEvent(roomId: string, eventType: string) {
    return this.sessionLogsRepo.save(this.sessionLogsRepo.create({ room_id: roomId, event_type: eventType }));
  }

  // Reacciona a booking.confirmed (sección 4.4): crea la sala de video real
  // en Daily.co (o una sala simulada si no hay DAILY_API_KEY configurada).
  async createForBooking(bookingId: string) {
    const existing = await this.roomsRepo.findOne({ where: { booking_id: bookingId } });
    if (existing) return existing;

    const providerRoom = await this.dailyClient.createRoom(bookingId);

    const room = await this.roomsRepo.save(
      this.roomsRepo.create({
        booking_id: bookingId,
        provider_room_id: providerRoom.providerRoomId,
        join_url: providerRoom.joinUrl,
        status: RoomStatus.READY,
      }),
    );
    this.logger.log(
      `Sala ${providerRoom.isMock ? "SIMULADA" : "real (Daily.co)"} creada para booking ${bookingId}`,
    );
    await this.logEvent(room.id, "room_ready");
    this.eventsPublisher.publishSessionRoomReady(room);
    return room;
  }

  
  async cancelForBooking(bookingId: string) {
    const room = await this.roomsRepo.findOne({
      where: { booking_id: bookingId },
    });
  
    // La reserva pudo cancelarse antes de crear una sala.
    if (!room) {
      this.logger.log(
        `Reserva ${bookingId} cancelada sin sala asociada`,
      );
      return;
    }
  
    // Evita intentar cerrar dos veces una sala finalizada.
    if (room.status === RoomStatus.ENDED) {
      this.logger.log(
        `La sala ${room.id} ya estaba finalizada`,
      );
      return;
    }
  
    // Primero cerramos la sala real en Daily.co.
    await this.dailyClient.deleteRoom(room.provider_room_id);
  
    room.status = RoomStatus.ENDED;
    await this.roomsRepo.save(room);
  
    await this.logEvent(room.id, "booking_cancelled");
  
    this.logger.log(
      `Sala ${room.id} cerrada por cancelación de reserva ${bookingId}`,
    );
  }


  async findByBooking(bookingId: string) {
    const room = await this.roomsRepo.findOne({ where: { booking_id: bookingId } });
    if (!room) throw new NotFoundException(`No hay sala para la reserva ${bookingId}`);
    return room;
  }

  async findOne(id: string) {
    const room = await this.roomsRepo.findOne({ where: { id } });
    if (!room) throw new NotFoundException(`Sala ${id} no encontrada`);
    return room;
  }

  // GET /sessions/{id}/token del documento (sección 4.4). Devuelve el
  // join_url real que entregó Daily.co al crear la sala, o null + isMock
  // si el servicio está corriendo sin credenciales configuradas — nunca
  // una URL inventada que parezca real pero no resuelva. Cada llamada
  // queda registrada en session_logs como "alguien pidió entrar".
  async getToken(id: string) {
    const room = await this.findOne(id);
    await this.logEvent(room.id, "join_requested");
    return {
      roomId: room.id,
      joinUrl: room.join_url,
      isMock: room.join_url === null,
      status: room.status,
    };
  }

    async end(id: string) {
    const room = await this.findOne(id);
    room.status = RoomStatus.ENDED;
    room.duration_minutes = Math.round(
      (Date.now() - room.created_at.getTime()) / 60000,
    );
    await this.roomsRepo.save(room);
    await this.logEvent(room.id, "session_ended");
    await this.dailyClient.deleteRoom(room.provider_room_id);
    this.eventsPublisher.publishSessionCompleted(room);
    return room;
  }
  listLogs(roomId: string) {
    return this.sessionLogsRepo.find({ where: { room_id: roomId }, order: { timestamp: "ASC" } });
  }

  // Daily.co no expone jitter/packet loss por su API REST (haría falta
  // incrustar la llamada con daily-js y escuchar sus eventos
  // "network-quality-change" en el navegador). Este endpoint queda listo
  // para que el frontend envíe lo que el propio navegador mida
  // (navigator.connection) — ver nota en qos-metric.entity.ts.
    async recordQosSample(
    roomId: string,
    data: { jitterMs?: number; packetLossPct?: number },
  ) {
    const room = await this.findOne(roomId);
  
    const sample = await this.qosMetricsRepo.save(
      this.qosMetricsRepo.create({
        room_id: roomId,
        jitter_ms: data.jitterMs ?? null,
        packet_loss_pct: data.packetLossPct ?? null,
      }),
    );
  
    // Umbrales iniciales configurables para detectar mala calidad.
    const jitterThreshold = Number(
      process.env.QOS_JITTER_THRESHOLD_MS ?? 50,
    );
    const packetLossThreshold = Number(
      process.env.QOS_PACKET_LOSS_THRESHOLD_PCT ?? 5,
    );
  
    const degraded =
      (data.jitterMs !== undefined &&
        data.jitterMs > jitterThreshold) ||
      (data.packetLossPct !== undefined &&
        data.packetLossPct > packetLossThreshold);
  
    if (degraded) {
      this.logger.warn(
        `Calidad degradada en sala ${roomId}: jitter=${data.jitterMs ?? "N/A"}ms, pérdida=${data.packetLossPct ?? "N/A"}%`,
      );
  
      this.eventsPublisher.publishSessionQosDegraded(
        room.id,
        room.booking_id,
        data.jitterMs ?? null,
        data.packetLossPct ?? null,
      );
    }
  
    return sample;
  }

  listQos(roomId: string) {
    return this.qosMetricsRepo.find({ where: { room_id: roomId }, order: { sampled_at: "ASC" } });
  }
}
