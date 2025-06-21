import { CreateDateColumn, Entity, PrimaryGeneratedColumn, Column, JoinColumn, ManyToOne, UpdateDateColumn } from 'typeorm';
import { User } from './User.entity';
import { Category } from './Category.entity';

/**
 * 岗位安全培训矩阵表实体
 */
@Entity('tr_matrix')
export class Matrix {
  @PrimaryGeneratedColumn({ name: '_id' })
  _id!: number;

  @Column({ type: 'integer', nullable: true })
  category_id: number | null = null;

  @Column({ type: 'varchar', length: 20, nullable: false })
  ref!: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  standard: string | null = null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  assessment_method: string | null = null;

  @Column({ type: 'integer', nullable: true })
  creator: number | null = null;

  @CreateDateColumn({ name: 'create_time' })
  create_time!: Date;

  @Column({ type: 'integer', nullable: true })
  updater: number | null = null;

  @UpdateDateColumn({ name: 'update_time' })
  update_time!: Date;

  // 关联关系
  @ManyToOne(() => Category)
  @JoinColumn({ name: 'category_id' })
  category: Category | null = null;

  @ManyToOne(() => User, {
    createForeignKeyConstraints: false
  })
  @JoinColumn({ name: 'creator' })
  creatorEntity!: User;

  @ManyToOne(() => User, {
    createForeignKeyConstraints: false
  })
  @JoinColumn({ name: 'updater' })
  updaterEntity!: User;
}