import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index, ManyToMany, OneToMany } from 'typeorm';
import { Courseware } from './Courseware.entity';
import { User } from './User.entity';

@Entity('tr_materials')
export class Material {
  @PrimaryGeneratedColumn()
  _id!: number;

  @Column({ type: 'varchar', length: 100, nullable: false })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description: string | null = null;

  @Column({ type: 'varchar', length: 255, nullable: false })
  file_path!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  file_type: string | null = null;

  @Column({ type: 'integer', nullable: true })
  file_size: number | null = null;

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
}