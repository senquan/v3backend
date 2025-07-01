import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { Ticket } from "./ticket.model";
import { User } from "./user.model";
import { TicketComment } from "./ticket-comment.model";

@Entity("ticket_attachments")
export class TicketAttachment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "ticket_id" })
  ticketId!: number;

  @ManyToOne(() => Ticket, ticket => ticket.attachments)
  @JoinColumn({ name: "ticket_id" })
  ticket!: Ticket;

  @Column({ name: "user_id" })
  userId!: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column({ name: "comment_id" })
  commentId!: number;

  @ManyToOne(() => TicketComment)
  @JoinColumn({ name: "comment_id" })
  comment!: TicketComment;

  @Column({ length: 255 })
  filename!: string;

  @Column({ length: 255 })
  path!: string;

  @Column({ length: 100 })
  mimetype!: string;

  @Column()
  size!: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @Column({ name: "is_deleted", type: "tinyint", default: 0 })
  isDeleted!: number;
}