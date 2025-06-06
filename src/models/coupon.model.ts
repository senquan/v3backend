import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from "typeorm";
import { User } from "./user.model";
import { CouponUser } from "./coupon-user.model";

export enum CouponType {
  DISCOUNT = 1,    // 折扣券
  CASH = 2,        // 现金券(无门槛)
  GIFT = 3,        // 赠品券
  SHIPPING = 4,     // 包邮券
  THRESHOLD = 5    // 满减券
}

export enum CouponStatus {
  DRAFT = 0,       // 草稿
  ACTIVE = 1,      // 已激活
  EXPIRED = 2,     // 已过期
  DISABLED = 3     // 已禁用
}

@Entity("coupons")
export class Coupon {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 100 })
  name!: string;

  @Column({ type: 'int', comment: '优惠券类型' })
  type!: CouponType;

  @Column({ name: 'platform_id', nullable: true, comment: '平台ID' })
  platformId: number | 0 = 0;

  @Column({ type: 'varchar', length: 50, nullable: true })
  code: string | null = null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, comment: '优惠金额' })
  amount: number | null = null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, comment: '折扣率，如8.5表示85折' })
  discount: number | null = null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, comment: '最低消费金额' })
  minAmount: number | null = null;

  @Column({ type: 'datetime', name: 'start_time' })
  startTime!: Date;

  @Column({ type: 'datetime', name: 'end_time' })
  endTime!: Date;

  @Column({ type: 'int', default: 0, comment: '发放总量, 0表示不限量' })
  totalCount: number = 0;

  @Column({ type: 'int', default: 0, comment: '已领取数量' })
  receivedCount: number = 0;

  @Column({ type: 'int', default: 0, comment: '已使用数量' })
  usedCount: number = 0;

  @Column({ type: 'int', default: 1, comment: '每人限领数量，0表示不限制' })
  perLimit: number = 1;

  @Column({ type: 'text', nullable: true, comment: '使用范围，如指定商品、指定分类等' })
  scope: string | null = null;

  @Column({ type: 'text', nullable: true, comment: '使用规则' })
  useRules: string | null = null;

  @Column({ type: 'text', nullable: true, comment: '使用说明' })
  description: string | null = null;

  @Column({ type: 'int', default: CouponStatus.DRAFT, comment: '优惠券状态' })
  status!: CouponStatus;

  @Column({ name: 'creator_id', nullable: true })
  creatorId: number | null = null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'creator_id' })
  creator: User | null = null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @Column({ name: 'is_deleted', type: 'tinyint', default: 0 })
  isDeleted!: number;

  @OneToMany(() => CouponUser, couponUser => couponUser.coupon)
  couponUsers!: CouponUser[];
}