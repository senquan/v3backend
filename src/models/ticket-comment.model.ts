import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { User } from "./user.model";
import { Ticket } from "./ticket.model";

@Entity("ticket_comments")
export class TicketComment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "ticket_id" })
  ticketId!: number;

  @ManyToOne(() => Ticket, ticket => ticket.comments)
  @JoinColumn({ name: "ticket_id" })
  ticket!: Ticket;

  @Column({ name: "user_id" })
  userId!: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column({ type: "text" })
  content!: string;

  @Column({ name: "is_internal", default: false })
  isInternal!: boolean; // 是否为内部评论，不对客户可见

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @Column({ name: "is_deleted", type: "tinyint", default: 0 })
  isDeleted!: number;
}