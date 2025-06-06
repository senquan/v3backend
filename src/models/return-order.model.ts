import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn } from "typeorm";
import { ReturnOrderItem } from "./return-order-item.model";
import { Order } from "./order.model";

@Entity("return_orders")
export class ReturnOrder {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 100 })
  name!: string;

  @Column({ name: 'order_id' })
  orderId!: number;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'order_id' })
  order!: Order;

  @Column({ name: 'platform_id' })
  platformId!: number;

  @Column({ name: 'customer_id' })
  customerId!: number;

  @Column({ name: 'user_id' })
  userId!: number;

  @Column({ name: 'reviewer_id', nullable: true })
  reviewerId?: number;

  @Column()
  quantity!: number;

  @Column({ name: 'return_amount', type: 'decimal', precision: 10, scale: 2 })
  returnAmount!: number;

  @Column()
  status!: number;

  @Column({ name: 'refund_status' })
  refundStatus!: number;

  @Column({ name: 'refund_at', type: 'datetime', nullable: true })
  refundAt?: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reason: string | null = null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  remark: string | null = null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @Column({ name: 'is_deleted', type: 'tinyint', default: 0 })
  isDeleted!: number;

  @OneToMany(() => ReturnOrderItem, item => item.returnOrder)
  items!: ReturnOrderItem[];
}