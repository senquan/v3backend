import { Entity, PrimaryGeneratedColumn, Column, OneToMany, UpdateDateColumn } from 'typeorm';

@Entity('category')
export class Category {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'parent_id', type: 'int', default: 0, comment: '父分类ID' })
  parentId: number | 0 = 0;

  @OneToMany(() => Category, category => category.parentId)
  children!: Category[];

  @Column({ length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 255, nullable: true, comment: '备注' })
  remark: string | '' = '';

  @Column({ type: 'varchar', length: 255, nullable: true, comment: '图标' })
  icon: string | null = null;

  @Column({ default: 0 })
  sort!: number;

  @Column({ name: 'is_deleted', type: 'tinyint', default: 0 })
  isDeleted!: number;
  
  @UpdateDateColumn({ name: 'update_at' })
  updateAt!: Date;
}