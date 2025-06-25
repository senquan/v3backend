import { Entity, PrimaryColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Promotion } from './promotion.model';
import { Dict } from './dict.model';

@Entity('promotion_platforms')
export class PromotionPlatforms {
  @PrimaryColumn({ name: 'promotion_id' })
  @Index()
  promotionId!: number;

  @PrimaryColumn({ name: 'platform_id' })
  @Index()
  platformId!: number;

  @ManyToOne(() => Promotion, promotion => promotion.platforms)
  @JoinColumn({ name: 'promotion_id' })
  promotion!: Promotion;

  platformInfo?: Dict;
}