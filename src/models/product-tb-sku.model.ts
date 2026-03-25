import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Product } from './product.model';

@Entity('product_tb_sku')
export class ProductTbSku {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'product_id' })
  productId!: number;

  @Column({ length: 50 })
  @Index()
  materialCode!: string;

  @Column({ length: 50, name: 'tb_item_id' })
  tbItemId!: string;

  @Column({ length: 50, name: 'tb_sku_id' })
  tbSkuId!: string;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product!: Product;
}