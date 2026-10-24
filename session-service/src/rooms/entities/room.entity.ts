import { Check, Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

export enum RoomStatus {
  READY = "ready",
  ACTIVE = "active",
  ENDED = "ended",
}

@Entity("rooms")
@Check(`"status" IN ('ready','active','ended')`)
export class Room {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  // Referencia lógica a booking_db.bookings.id (sección 5.4 del documento).
  @Index({ unique: true })
  @Column()
  booking_id: string;

  // Id de sala devuelto por el proveedor externo (Daily.co, sección 4.4).
  // Si DAILY_API_KEY no está configurada, se genera un id local y
  // join_url queda en modo simulado (ver DailyClient).
  @Column()
  provider_room_id: string;

  // URL real y abrible de la sala (la que devuelve Daily.co), o null si el
  // servicio está corriendo en modo simulado sin credenciales configuradas.
  @Column({ nullable: true })
  join_url: string | null;

  @Column({ type: "enum", enum: RoomStatus, default: RoomStatus.READY })
  status: RoomStatus;

    // Duración de la sesión en minutos, calculada en RoomsService.end() como
  // el tiempo entre la creación de la sala y el cierre de la llamada. Es
  // una aproximación (ver LEEME de analytics-service): Daily.co en el plan
  // gratuito no expone el inicio real de la llamada por su API REST.
  @Column({ type: "int", nullable: true })
  duration_minutes: number | null;

  @CreateDateColumn()
  created_at: Date;
}
