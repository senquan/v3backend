import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { TicketFollowUpConfig } from './ticket-follow-up-config.model';
import { TicketFollowUpStage } from './ticket-follow-up-stage.model';
import { Order } from './order.model';
import { Ticket } from './ticket.model';

export enum FollowUpRecordStatus {
  PENDING = 0,       // 待触发
  TRIGGERED = 1,     // 已发工单
  COMPLETED = 2,     // 已完成
  SKIPPED = 3        // 已跳过（订单已成交）
}

@Entity('ticket_follow_up_records')
export class TicketFollowUpRecord {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'order_id', type: 'int', comment: '关联订单ID' })
  @Index()
  orderId!: number;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'order_id' })
  order!: Order;

  @Column({ name: 'config_id', type: 'int', comment: '使用的配置ID' })
  configId!: number;

  @ManyToOne(() => TicketFollowUpConfig)
  @JoinColumn({ name: 'config_id' })
  config!: TicketFollowUpConfig;

  @Column({ name: 'stage_id', type: 'int', comment: '当前阶段ID' })
  stageId!: number;

  @ManyToOne(() => TicketFollowUpStage)
  @JoinColumn({ name: 'stage_id' })
  stage!: TicketFollowUpStage;

  @Column({ name: 'stage_order', type: 'tinyint', comment: '阶段序号' })
  stageOrder!: number;

  @Column({ name: 'ticket_id', type: 'int', nullable: true, comment: '关联工单ID（创建后填入）' })
  ticketId: number | null = null;

  @ManyToOne(() => Ticket, { nullable: true })
  @JoinColumn({ name: 'ticket_id' })
  ticket: Ticket | null = null;

  @Column({ type: 'tinyint', default: FollowUpRecordStatus.PENDING, comment: '状态：0-待触发 1-已发工单 2-已完成 3-已跳过' })
  status!: number;

  @Column({ name: 'trigger_at', type: 'datetime', comment: '计划触发时间' })
  @Index()
  triggerAt!: Date;

  @Column({ name: 'completed_at', type: 'datetime', nullable: true, comment: '完成时间' })
  completedAt: Date | null = null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
