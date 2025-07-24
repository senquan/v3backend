import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import { TrainerTag } from './TrainerTag.entity';

@Entity('tags')
export class Tag {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  name: string | null = null; // 标签名称

  @Column({ type: 'integer', nullable: true })
  @Index('idx_tags_parent_id')
  parent_id: number | null = null; // 父标签ID

  @Column({ type: 'varchar', length: 20, nullable: true })
  color: string | null = null; // 标签颜色

  @Column({ type: 'text', nullable: true })
  description: string | null = null; // 标签描述

  @Column({ type: 'int', default: 0 })
  sort: number = 0; // 标签排序

  @Column({ type: 'int', default: 0 })
  category!: number; // 标签分类

  @Column({ type: 'boolean', default: false })
  is_deleted!: boolean; // 是否删除

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  // 关联关系
  @ManyToOne(() => Tag, tag => tag.children, {
    createForeignKeyConstraints: false
  })
  @JoinColumn({ name: 'parent_id' })
  parent!: Tag;

  @OneToMany(() => Tag, tag => tag.parent)
  children!: Tag[];

  @OneToMany(() => TrainerTag, trainerTag => trainerTag.tag)
  trainerTags!: TrainerTag[];
}