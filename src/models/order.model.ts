import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { OrderItem } from "./order-item.model";
import { Customer } from "./customer.model";
import { OneToMany } from "typeorm";
import { Dict } from './dict.model';
import { User } from './user.model';

export enum OrderType {
  COMMON = 1,
  PROJECT = 2,
}

@Entity("orders")
export class Order {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 100 })
  name!: string;

  @Column({ type: 'smallint', default: OrderType.COMMON, comment: '订单类型' })  
  type!: OrderType;

  @Column({ name: 'platform_id' })
  platformId!: number;

  @Column({ name: 'auth_code', length: 50 })
  authCode!: string;

  @Column({ name: 'customer_id' })
  customerId!: number;

  @ManyToOne(() => Customer, customer => customer.orders)
  customer!: Customer;

  @Column({ name: 'user_id' })
  userId!: number;

  @Column({ name: 'reviewer_id', nullable: true })
  reviewerId?: number;

  @Column()
  quantity!: number;

  @Column({ name: 'origin_price', type: 'decimal', precision: 10, scale: 2 })
  originPrice!: number;

  @Column({ name: 'pay_price', type: 'decimal', precision: 10, scale: 2 })
  payPrice!: number;

  @Column()
  status!: number;

  @Column({ name: 'pay_status' })
  payStatus!: number;

  @Column({ name: 'pay_at', type: 'datetime', nullable: true })
  payAt?: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  prices: string | null = null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  remark: string | null = null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @Column({ name: 'is_deleted', type: 'tinyint', default: 0 })
  isDeleted!: number;

  // 关系
  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @OneToMany(() => OrderItem, item => item.order)
  items!: OrderItem[];

  platform?: Dict;
}