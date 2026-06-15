import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from "typeorm";
import { User } from "./user.model";
import { Staff } from "./staff.model";
import { Order } from "./order.model";
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
  ticketType!: number; // 工单类型：1-订单缺货 2-订单售后 3-产品售后 4-物流售后 5-知识更新 6-仓库缺货 7-咨询 8-投诉 9-建议 10-跟单提醒

  @Column({ name: "priority", default: 2 })
  priority!: number; // 优先级：1-日常，2-一般，3-紧急，4-加急，5-特急

  @Column({ default: 1 })
  status!: number; // 状态：1-待处理，2-处理中，3-待确认，4-已关闭，5-已取消

  @Column({ name: "creator_id" })
  creatorId!: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: "creator_id" })
  creator!: User;

  @Column({ name: "assignee_id", nullable: true })
  assigneeId?: number;

  @ManyToOne(() => Staff, { nullable: true })
  @JoinColumn({ name: "assignee_id" })
  assignee?: Staff;

  @Column({ name: "product_id", nullable: true })
  productId?: number;

  @Column({ name: "order_id", nullable: true })
  orderId?: number;

  @ManyToOne(() => Order)
  @JoinColumn({ name: "order_id" })
  order!: Order;

  @Column({ type: "varchar", length: 255, nullable: true })
  related?: string;

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