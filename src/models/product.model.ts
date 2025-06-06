import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, ManyToMany, JoinTable } from 'typeorm';
import { SpecItem } from './spec-item.model';
import { Tag } from './tag.model';
import { ProductModel } from './product-model.model';
import { ProductSeries } from './product-series.model';

@Entity('product')
export class Product {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 255 })
  name!: string;

  @Column({ length: 50, unique: true })
  sku!: string;

  @Column({ name: 'material_id', length: 50 })
  materialId!: string;

  @Column({ type: 'varchar', name: 'bar_code', length: 100, nullable: true })
  barCode: string | null = null;

  @Column({ name: 'model_type_id', nullable: true })
  modelTypeId: number | null = null;

  @ManyToOne(() => ProductModel, { nullable: true })
  @JoinColumn({ name: 'model_type_id' })
  modelType: ProductModel | null = null;

  @Column({ name: 'serie_id', default: 0 })
  serieId!: number;

  @ManyToOne(() => ProductSeries, { nullable: true })
  @JoinColumn({ name: 'serie_id' })
  serie: ProductSeries | null = null;

  @Column({ type: 'tinyint', default: 1 })
  status!: number;

  @Column({ name: 'color_id', nullable: true })
  colorId: number | null = null;

  @ManyToOne(() => SpecItem, { nullable: true })
  @JoinColumn({ name: 'color_id' })
  color: SpecItem | null = null;

  @Column({ name: 'base_price', type: 'decimal', precision: 10, scale: 2, default: 0 })
  basePrice!: number;

  @Column({ name: 'project_price', type: 'decimal', precision: 10, scale: 2, default: 0 })
  projectPrice!: number;

  @Column({ name: 'factory_price', type: 'decimal', precision: 10, scale: 2, default: 0 })
  factoryPrice!: number;

  @Column({ type: 'text', name: 'image_urls', nullable: true })
  imageUrls: string | null = null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  remark: string | null = null;

  @CreateDateColumn({ name: 'create_at' })
  createAt!: Date;

  @UpdateDateColumn({ name: 'update_at' })
  updateAt!: Date;

  @Column({ name: 'is_deleted', type: 'tinyint', default: 0 })
  isDeleted!: number;

  @ManyToMany(() => Tag, tag => tag.products)
  @JoinTable({
    name: 'product_tags',
    joinColumn: {
      name: 'product_id',
      referencedColumnName: 'id'
    },
    inverseJoinColumn: {
      name: 'tag_id',
      referencedColumnName: 'id'
    }
  })
  tags!: Tag[];
}