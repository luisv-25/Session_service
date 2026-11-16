import { NotFoundException } from "@nestjs/common";
import { RoomStatus } from "../../src/rooms/entities/room.entity";
import { RoomsService } from "../../src/rooms/rooms.service";

// Pruebas UNITARIAS de RoomsService: repositorios (BD), Daily.co y RabbitMQ se reemplazan por mocks.
describe("RoomsService (unitaria, con mocks)", () => {
  const roomsRepo = { findOne: jest.fn(), create: jest.fn((x) => x), save: jest.fn(async (x) => ({ id: "room-1", ...x })) };
  const logsRepo = { create: jest.fn((x) => x), save: jest.fn(async (x) => x), find: jest.fn() };
  const qosRepo = { create: jest.fn((x) => x), save: jest.fn(async (x) => x), find: jest.fn() };
  const events = { publishSessionRoomReady: jest.fn(), publishSessionCompleted: jest.fn() };
  const daily = { createRoom: jest.fn(), deleteRoom: jest.fn() };
  const service = new RoomsService(roomsRepo as any, logsRepo as any, qosRepo as any, events as any, daily as any);

  beforeEach(() => jest.clearAllMocks());
  afterEach(() => jest.useRealTimers());

  it("Unitaria 1: crear sala para una reserva es idempotente y, si es nueva, la deja 'ready' en modo simulado, registra el log y publica session.room.ready", async () => {
    // Ya existe: se devuelve la misma sala sin llamar a Daily.co ni publicar
    roomsRepo.findOne.mockResolvedValueOnce({ id: "existente", booking_id: "b1" });
    const repetida = await service.createForBooking("b1");
    expect(repetida.id).toBe("existente");
    expect(daily.createRoom).not.toHaveBeenCalled();
    expect(events.publishSessionRoomReady).not.toHaveBeenCalled();

    // No existe: sala simulada (join_url null)
    roomsRepo.findOne.mockResolvedValueOnce(null);
    daily.createRoom.mockResolvedValue({ providerRoomId: "mock-room-b2", joinUrl: null, isMock: true });
    const nueva = await service.createForBooking("b2");

    expect(nueva).toMatchObject({ booking_id: "b2", provider_room_id: "mock-room-b2", join_url: null, status: RoomStatus.READY });
    expect(logsRepo.save).toHaveBeenCalledWith(expect.objectContaining({ room_id: "room-1", event_type: "room_ready" }));
    expect(events.publishSessionRoomReady).toHaveBeenCalledTimes(1);
  });

  it("Unitaria 2: cerrar la sesión calcula la duración en minutos, borra la sala en el proveedor y publica session.completed con esa duración", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-01-01T10:45:00Z"));
    const sala: any = {
      id: "room-9",
      booking_id: "b9",
      provider_room_id: "abc",
      status: RoomStatus.ACTIVE,
      created_at: new Date("2026-01-01T10:00:00Z"),
      duration_minutes: null,
    };
    roomsRepo.findOne.mockResolvedValue(sala);

    const cerrada = await service.end("room-9");

    expect(cerrada.status).toBe(RoomStatus.ENDED);
    expect(cerrada.duration_minutes).toBe(45);
    expect(daily.deleteRoom).toHaveBeenCalledWith("abc");
    expect(logsRepo.save).toHaveBeenCalledWith(expect.objectContaining({ event_type: "session_ended" }));
    expect(events.publishSessionCompleted).toHaveBeenCalledWith(expect.objectContaining({ booking_id: "b9", duration_minutes: 45 }));

    // Sala inexistente -> 404 y no se publica nada más
    roomsRepo.findOne.mockResolvedValue(null);
    await expect(service.end("nada")).rejects.toBeInstanceOf(NotFoundException);
    expect(events.publishSessionCompleted).toHaveBeenCalledTimes(1);
  });
});
