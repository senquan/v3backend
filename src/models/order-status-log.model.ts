import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('order_status_logs')
export class OrderStatusLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'order_id' })
  orderId!: number;

  @Column({ name: 'order_type', type: 'tinyint', default: 0, comment: '订单类型（0:普通订单, 1:退货订单）' })
  orderType!: number;

  @Column({ name: 'previous_status', type: 'tinyint', nullable: true, comment: '变更前状态' })
  previousStatus: number | null = null;

  @Column({ name: 'current_status', type: 'tinyint', comment: '变更后状态' })
  currentStatus!: number;

  @Column({ name: 'operator_id', type: 'int', default: 0 })
  operatorId!: number;

  @Column({ name: 'operator_name', length: 50 })
  operatorName: string = '';

  @Column({ length: 50, comment: '操作类型（如：创建、支付、发货、退货申请等）' })
  operation: string = '';

  @Column({ type: 'varchar', length: 255, nullable: true })
  remark: string | null = null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}