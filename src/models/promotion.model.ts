import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { PromotionRule } from '../models/promotion-rule.model';

export enum PromotionType {
  DAILY_DISCOUNT = 1,    // 日常折扣
  EVENT_SALE = 2,  // 活动特价
  FLASH_SALE = 3   // 限时促销
}

export enum PromotionStatus {
  DRAFT = 0,       // 草稿
  SCHEDULED = 1,   // 已排期
  ACTIVE = 2,      // 进行中
  ENDED = 3,       // 已结束
  CANCELLED = 4    // 已取消
}

@Entity('promotion')
export class Promotion {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 100 })
  name!: string;

  @Column({ type: 'int', comment: '活动类型' })
  type!: PromotionType;

  @Column({ type: 'datetime', name: 'start_time' })
  startTime!: Date;

  @Column({ type: 'datetime', name: 'end_time' })
  endTime!: Date;

  @Column({ type: 'int', default: PromotionStatus.DRAFT, comment: '活动状态' })
  status!: PromotionStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null = null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, comment: '折扣率, 如8.5表示85折' })
  discountRate: number | null = null;

  @Column({ type: 'int', nullable: true, comment: '限购数量' })
  limitQuantity: number | null = null;

  @Column({ name: 'platform_id', nullable: true, comment: '平台ID' })
  platformId: number | 0 = 0;

  @Column({ name: 'user_id', comment: '创建人ID' })
  userId!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @Column({ name: 'is_deleted', type: 'tinyint', default: 0 })
  isDeleted!: number;

  @OneToMany(() => PromotionRule, rule => rule.promotion)
  rules!: PromotionRule[];

  @Column({ type: 'boolean', default: false, comment: '是否可与其他促销活动叠加' })
  isStackable: boolean = false;
}