import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import { BookingConfirmedConsumer } from "../../src/events/booking-confirmed.consumer";
import { EventsPublisher } from "../../src/events/events.publisher";
import { DailyClient } from "../../src/rooms/daily.client";
import { createTestApp, fakeEventsPublisher } from "../helpers/test-app";

// Prueba de INTEGRACIÓN: HTTP -> controlador -> servicio -> PostgreSQL real.
// RabbitMQ (publicador) y Daily.co (cliente) se reemplazan por fakes: sin red.
describe("Integración: sala de videollamada desde reserva confirmada hasta cierre de sesión", () => {
  let app: INestApplication;
  const events = fakeEventsPublisher();
  const dailyCalls: string[] = [];
  const dailyFake = {
    createRoom: async (bookingId: string) => {
      dailyCalls.push(`create:${bookingId}`);
      return { providerRoomId: `mock-room-${bookingId}`, joinUrl: null, isMock: true };
    },
    deleteRoom: async (id: string) => {
      dailyCalls.push(`delete:${id}`);
    },
  };

  beforeAll(async () => {
    app = await createTestApp(
      [AppModule],
      [
        { provide: EventsPublisher, useValue: events },
        { provide: DailyClient, useValue: dailyFake },
      ],
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it("booking.confirmed crea la sala, se consulta, se pide token, se miden QoS y al cerrar se publica session.completed con la duración", async () => {
    const http = request(app.getHttpServer());
    const consumer = app.get(BookingConfirmedConsumer);
    const canal = { ack: jest.fn(), nack: jest.fn() };
    const ctx: any = { getChannelRef: () => canal, getMessage: () => ({}) };
    const evento = { eventName: "booking.confirmed", occurredAt: new Date().toISOString(), data: { bookingId: "reserva-1" } };

    // CREAR: el consumidor del evento crea la sala (y es idempotente ante reentregas)
    await consumer.handleBookingConfirmed(evento, ctx);
    await consumer.handleBookingConfirmed(evento, ctx);
    expect(canal.ack).toHaveBeenCalledTimes(2);
    expect(canal.nack).not.toHaveBeenCalled();
    expect(dailyCalls.filter((c) => c === "create:reserva-1")).toHaveLength(1);
    expect(events.calls.filter((c: any) => c.event === "publishSessionRoomReady")).toHaveLength(1);

    // CONSULTAR por reserva y por id
    const porReserva = await http.get("/api/v1/sessions/booking/reserva-1").expect(200);
    const id = porReserva.body.id;
    expect(porReserva.body).toMatchObject({ booking_id: "reserva-1", status: "ready", join_url: null });
    await http.get(`/api/v1/sessions/${id}`).expect(200);

    // Errores: sala/reserva inexistente -> 404
    await http.get("/api/v1/sessions/booking/no-existe").expect(404);
    await http.get("/api/v1/sessions/00000000-0000-0000-0000-000000000000").expect(404);

    // TOKEN: modo simulado (isMock) y queda registrado "join_requested"
    const token = await http.get(`/api/v1/sessions/${id}/token`).expect(200);
    expect(token.body).toMatchObject({ roomId: id, joinUrl: null, isMock: true, status: "ready" });

    // QoS: se guarda y se lista
    await http.post(`/api/v1/sessions/${id}/qos-samples`).send({ jitterMs: 12.5, packetLossPct: 0.8 }).expect(201);
    const qos = await http.get(`/api/v1/sessions/${id}/qos-samples`).expect(200);
    expect(qos.body).toHaveLength(1);
    expect(Number(qos.body[0].jitter_ms)).toBeCloseTo(12.5);

    // CERRAR: estado ended, duración calculada, evento session.completed y sala borrada en el proveedor
    const fin = await http.patch(`/api/v1/sessions/${id}/end`).expect(200);
    expect(fin.body.status).toBe("ended");
    expect(fin.body.duration_minutes).toBe(0); // recién creada: ~0 minutos
    const completado = events.calls.find((c: any) => c.event === "publishSessionCompleted");
    expect(completado.args[0]).toMatchObject({ id, booking_id: "reserva-1", duration_minutes: 0 });
    expect(dailyCalls).toContain("delete:mock-room-reserva-1");

    // Bitácora en orden: room_ready, join_requested, session_ended
    const logs = await http.get(`/api/v1/sessions/${id}/logs`).expect(200);
    expect(logs.body.map((l: any) => l.event_type)).toEqual(["room_ready", "join_requested", "session_ended"]);
  });
});
