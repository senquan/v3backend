import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, ManyToMany, JoinTable, OneToMany } from 'typeorm';
import { User } from './User.entity';
import { Material } from './Material.entity';
import { CoursewareMaterial } from './CoursewareMaterial.entity';

@Entity('tr_coursewares')
export class Courseware {
  @PrimaryGeneratedColumn()
  _id!: number;

  @Column({ type: 'varchar', length: 100, nullable: false })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description: string | null = null;

  @Column({ type: 'smallint', default: 0 })
  category!: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  tags: string | null = null;

  @Column({ type: 'integer', default: 0 })
  status!: number;

  @Column({ type: 'integer', default: 0 })
  view_count!: number;

  @Column({ type: 'integer', default: 0 })
  download_count!: number;

  @Column({ type: 'integer', default: 0 })
  is_deleted!: number;

  @CreateDateColumn()
  created_time!: Date;

  @UpdateDateColumn()
  updated_time!: Date;

  // 关联关系
  @ManyToOne(() => User)
  @JoinColumn({ name: 'creator' })
  creatorEntity!: User;

  @Column({ type: 'integer', nullable: true })
  creator: number | null = null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'updater' })
  updaterEntity!: User;

  @Column({ type: 'integer', nullable: true })
  updater: number | null = null;
  
  // 一对多关系：课件与关联表
  @OneToMany(() => CoursewareMaterial, coursewareMaterial => coursewareMaterial.courseware)
  coursewareMaterials!: CoursewareMaterial[];
}