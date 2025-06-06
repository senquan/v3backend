import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, ManyToMany, JoinTable } from 'typeorm';
import { Category } from './category.model';
import { Tag } from './tag.model';

@Entity('product_series')
export class ProductSeries {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'category_id', default: 0 })
  categoryId!: number;

  @ManyToOne(() => Category, { nullable: true })
  @JoinColumn({ name: 'category_id' })
  category: Category | null = null;

  @Column({ length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 255, nullable: true, comment: '图片' })
  image: string | null = null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  year: string | null = null;

  @Column({ default: 0 })
  sort!: number;

  @Column({ name: 'is_deleted', type: 'tinyint', default: 0 })
  isDeleted!: number;

  @ManyToMany(() => Tag, tag => tag.series)
  @JoinTable({
    name: 'product_series_tags',
    joinColumn: {
      name: 'series_id',
      referencedColumnName: 'id',
    },
    inverseJoinColumn: {
      name: 'tag_id',
      referencedColumnName: 'id',
    },
  })
  tags!: Tag[];
}