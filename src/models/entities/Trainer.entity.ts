import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import { User } from './User.entity';
import { TrainerTag } from './TrainerTag.entity';

@Entity('trainers')
export class Trainer {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'smallint', default: 1 })
  type!: number; // 讲师类型：1-内部讲师，2-外部讲师

  @Column({ type: 'varchar', length: 50, nullable: true })
  name: string | null = null; // 讲师姓名 (外部讲师)

  @Column({ type: 'integer', nullable: true })
  @Index('idx_trainers_user_id')
  user_id: number | null = null; // 关联用户ID (内部讲师)

  @Column({ type: 'varchar', length: 255, nullable: true })
  avatar: string | null = null; // 讲师头像

  @Column({ type: 'smallint', default: 1 })
  grade!: number; // 讲师等级：1-新手，2-初级，3-中级，4-高级，5-资深，6-专家，7-金牌

  @Column({ type: 'varchar', length: 100, unique: true, nullable: true })
  email: string | null = null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null = null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  wechat: string | null = null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  position: string | null = null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  title: string | null = null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  idcard: string | null = null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  bank: string | null = null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  bankcard: string | null = null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  fee: number | null = null; // 讲师课酬

  @Column({ type: 'smallint', default: 0 })
  score!: number; // 评分为该讲师所属课程讲师评价平均值，满分5.0星，无评价为0星

  @Column({ type: 'text', nullable: true })
  introduction: string | null = null; // 讲师介绍

  @Column({ type: 'boolean', default: false })
  show_in_home!: boolean; // 是否展示在首页

  @Column({ type: 'boolean', default: false })
  is_deleted!: boolean; // 是否删除

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  // 关联关系
  @ManyToOne(() => User, {
    createForeignKeyConstraints: false
  })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @OneToMany(() => TrainerTag, trainerTag => trainerTag.trainer)
  trainerTags!: TrainerTag[];
}