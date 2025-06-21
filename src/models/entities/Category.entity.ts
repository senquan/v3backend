import { CreateDateColumn, Entity, PrimaryGeneratedColumn, Column, JoinColumn, OneToMany, ManyToOne, UpdateDateColumn } from 'typeorm';
import { User } from './User.entity';

@Entity('category')
export class Category {
  @PrimaryGeneratedColumn()
  _id!: number;

  @Column({ type: 'varchar', length: 100, nullable: false })
  name!: string;

  @Column({ type: 'smallint', default: 0 })
  type!: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  ref: string | null = null;

  @Column({ type: 'integer', nullable: true, comment: '父分类ID' })
  parent_id: number | null = null;

  @Column({ type: 'smallint', default: 0 })
  level!: number;

  @Column({ type: 'text', nullable: true })
  description: string | null = null;

  @Column({ type: 'integer', default: 0 })
  sort!: number;

  @Column({ type: 'integer', default: 0 })
  is_deleted!: number;

  @CreateDateColumn()
  created_time!: Date;

  @UpdateDateColumn()
  updated_time!: Date;

  // 关联关系
  @ManyToOne(() => User, {
    createForeignKeyConstraints: false
  })
  @JoinColumn({ name: 'creator' })
  creatorEntity!: User;

  @Column({ type: 'integer', nullable: true })
  creator: number | null = null;

  @ManyToOne(() => User, {
    createForeignKeyConstraints: false
  })
  @JoinColumn({ name: 'updater' })
  updaterEntity!: User;

  @Column({ type: 'integer', nullable: true })
  updater: number | null = null;

  @ManyToOne(() => Category)
  @JoinColumn({ name: 'parent_id' })
  parent: Category | null = null;

  @OneToMany(() => Category, category => category.parent_id)
  children!: Category[];
}