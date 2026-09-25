import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Room } from "./room.entity";

// Bitácora de la sala (sección 5.4 del documento): se separa de rooms por
// ser de cardinalidad no acotada (varios eventos por sala).
@Entity("session_logs")
export class SessionLog {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Room, { onDelete: "CASCADE" })
  @JoinColumn({ name: "room_id" })
  room: Room;

  @Index()
  @Column()
  room_id: string;

  // room_ready | join_requested | session_ended
  @Column()
  event_type: string;

  @CreateDateColumn()
  timestamp: Date;
}
