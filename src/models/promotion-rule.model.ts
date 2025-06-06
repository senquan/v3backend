import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Promotion } from './promotion.model';

export enum PromotionRuleType {
  AMOUNT_DISCOUNT = 1,    // 满额折扣
  AMOUNT_MINUS = 2,       // 满额减价
  QUANTITY_DISCOUNT = 3,  // 满件折扣
  QUANTITY_MINUS = 4,     // 满件减价
  DIRECT_DISCOUNT = 5,    // 直接折扣
  SPECIAL_PRICE = 6       // 特价
}

@Entity('promotion_rules')
export class PromotionRule {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 100 })
  name!: string;

  @Column({ type: 'int', comment: '规则类型' })
  type!: PromotionRuleType;

  @Column({ name: 'condition', type: 'json', comment: '规则条件, JSON' })
  condition!: string;

  @Column({ name: 'discount_value', type: 'decimal', precision: 5, scale: 2, nullable: true, comment: '折扣率, 如8.5表示85折' })
  discountValue!: number;

  @Column({ name: 'promotion_id' })
  promotionId!: number;

  @ManyToOne(() => Promotion, promotion => promotion.rules)
  @JoinColumn({ name: 'promotion_id' })
  promotion!: Promotion;

  @CreateDateColumn({ name: 'create_at' })
  createAt!: Date;

  @UpdateDateColumn({ name: 'update_at' })
  updateAt!: Date;

  @Column({ name: 'is_deleted', type: 'tinyint', default: 0 })
  isDeleted!: number;
}