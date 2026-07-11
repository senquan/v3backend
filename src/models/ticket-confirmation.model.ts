import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { Ticket } from "./ticket.model";
import { User } from "./user.model";

@Entity("ticket_confirmations")
export class TicketConfirmation {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "ticket_id" })
  ticketId!: number;

  @ManyToOne(() => Ticket, { onDelete: "CASCADE" })
  @JoinColumn({ name: "ticket_id" })
  ticket!: Ticket;

  @Column({ name: "user_id" })
  userId!: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column({ type: "datetime", nullable: true })
  confirmedAt?: Date;
}
