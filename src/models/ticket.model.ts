import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from "typeorm";
import { User } from "./user.model";
import { TicketComment } from "./ticket-comment.model";
import { TicketAttachment } from "./ticket-attachment.model";

@Entity("tickets")
export class Ticket {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 100 })
  title!: string;

  @Column({ type: "text" })
  content!: string;

  @Column({ name: "ticket_type" })
  ticketType!: number; // 工单类型：1-咨询，2-投诉，3-售后，4-建议

  @Column({ name: "priority", default: 2 })
  priority!: number; // 优先级：1-低，2-中，3-高，4-紧急

  @Column({ default: 1 })
  status!: number; // 状态：1-待处理，2-处理中，3-待确认，4-已关闭，5-已取消

  @Column({ name: "creator_id" })
  creatorId!: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: "creator_id" })
  creator!: User;

  @Column({ name: "assignee_id", nullable: true })
  assigneeId?: number;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "assignee_id" })
  assignee?: User;

  @Column({ name: "product_id", nullable: true })
  productId?: number;

  @Column({ name: "order_id", nullable: true })
  orderId?: number;

  @Column({ name: "processed_at", type: "datetime", nullable: true })
  processedAt?: Date;

  @Column({ name: "closed_at", type: "datetime", nullable: true })
  closedAt?: Date;

  @Column({ type: "varchar", length: 255, nullable: true })
  remark?: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;

  @Column({ name: "is_deleted", type: "tinyint", default: 0 })
  isDeleted!: number;

  @OneToMany(() => TicketComment, comment => comment.ticket)
  comments!: TicketComment[];

  @OneToMany(() => TicketAttachment, attachment => attachment.ticket)
  attachments!: TicketAttachment[];
}