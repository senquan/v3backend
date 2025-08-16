import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { PromotionV3 as Promotion } from './promotion-v3.model';

@Entity('promotion_rules_v3')
export class PromotionRuleV3 {

  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 100 })
  name!: string;

  @Column({ type: 'int', default: 100, comment: '优先级' })
  priority!: number;

  @Column({ type: 'tinyint', default: 0, comment: '是否排他' })
  exclusive!: number;

  @Column({ type: 'varchar', length: 255, comment: '规则描述' })
  description!: string;

  @Column({ type: 'json', comment: '规则条件, JSON' })
  contents!: string;

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