import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { Coupon } from "./coupon.model";
import { User } from "./user.model";
import { Order } from "./order.model";

export enum CouponUserStatus {
  UNUSED = 0,      // 未使用
  USED = 1,        // 已使用
  EXPIRED = 2      // 已过期
}

@Entity("coupon_users")
export class CouponUser {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'coupon_id' })
  couponId!: number;

  @ManyToOne(() => Coupon, coupon => coupon.couponUsers)
  @JoinColumn({ name: 'coupon_id' })
  coupon!: Coupon;

  @Column({ name: 'user_id' })
  userId!: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'int', default: CouponUserStatus.UNUSED, comment: '使用状态' })
  status!: CouponUserStatus;

  @Column({ name: 'order_id', nullable: true, comment: '使用的订单ID' })
  orderId: number | null = null;

  @ManyToOne(() => Order, { nullable: true })
  @JoinColumn({ name: 'order_id' })
  order: Order | null = null;

  @Column({ name: 'used_at', type: 'datetime', nullable: true, comment: '使用时间' })
  usedAt: Date | null = null;

  @CreateDateColumn({ name: 'create_at', comment: '领取时间' })
  createAt!: Date;

  @Column({ type: 'varchar', length: 50, nullable: true, comment: '优惠券码' })
  code: string | null = null;
}