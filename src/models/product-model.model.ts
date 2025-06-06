import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';

@Entity('product_model')
export class ProductModel {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 255, nullable: true, comment: '图片' })
  image: string | null = null;

  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0 })
  value!: number;

  @Column({ default: 0 })
  sort!: number;

  @Column({ name: 'is_deleted', type: 'tinyint', default: 0 })
  isDeleted!: number;
}