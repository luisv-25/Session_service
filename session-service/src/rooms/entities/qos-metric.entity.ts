import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Room } from "./room.entity";

// Métricas de calidad de la llamada (sección 5.4 del documento). Los
// valores son opcionales: Daily.co no expone jitter/packet loss por REST,
// así que esta tabla se alimenta con lo que el propio navegador del
// estudiante/tutor puede medir al entrar a la sala (Network Information
// API — navigator.connection), no con telemetría real de WebRTC de Daily.
// Ver POST /sessions/:id/qos-samples en rooms.controller.ts.
@Entity("qos_metrics")
export class QosMetric {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Room, { onDelete: "CASCADE" })
  @JoinColumn({ name: "room_id" })
  room: Room;

  @Index()
  @Column()
  room_id: string;

  @Column({ type: "numeric", precision: 8, scale: 2, nullable: true })
  jitter_ms: number | null;

  @Column({ type: "numeric", precision: 5, scale: 2, nullable: true })
  packet_loss_pct: number | null;

  @CreateDateColumn()
  sampled_at: Date;
}
