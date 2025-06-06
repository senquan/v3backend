import { Entity, PrimaryColumn, Index } from 'typeorm';

@Entity('product_tags')
export class ProductTag {
  @PrimaryColumn({ name: 'product_id' })
  @Index()
  productId!: number;

  @PrimaryColumn({ name: 'tag_id' })
  @Index()
  tagId!: number;
}