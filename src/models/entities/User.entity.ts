import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import * as md5 from 'md5';
import { TrainingPlan } from './TrainingPlan.entity';
import { Branch } from './Branch.entity';

@Entity({ 
  name: 'user',
  schema: 'sb' 
})
export class User {
  @PrimaryGeneratedColumn()
  _id!: number;

  @Column({ type: 'varchar', length: 50, unique: true, nullable: false })
  name!: string;

  @Column({ type: 'varchar', length: 50, nullable: false })
  realname!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  lang: string | null = null;

  @Column({ type: 'varchar', length: 100, nullable: false })
  password!: string;

  @Column({ type: 'smallint', default: 1 })
  type!: number;

  @Column({ type: 'integer', nullable: true })
  @Index('idx_users_branch_id')
  branch: number | null = null;

  @CreateDateColumn({ nullable: true })
  join_date: Date | null = null;

  @Column({ type: 'integer', default: 0 })
  age!: number;

  @Column({ type: 'boolean', default: true })
  married!: boolean;

  @Column({ type: 'integer', default: 1 })
  status!: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  email: string | null = null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null = null;

  @Column({ type: 'integer', nullable: true })
  oa_id: number | null = null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  wx_id: string | null = null;

  @Column({ type: 'integer', nullable: true })
  entrance: number | null = null;

  @Column({ type: 'text', nullable: true })
  notes: string | null = null;

  @Column({ type: 'integer', default: 0 })
  failed!: number;

  @CreateDateColumn({ nullable: true })
  password_modify_date: Date | null = null;

  @CreateDateColumn()
  create_time!: Date;

  @UpdateDateColumn()
  update_time!: Date;

  @Column({ type: 'integer' })
  @Index('idx_users_creator_id')
  creator!: number;

  @Column({ type: 'integer' })
  @Index('idx_users_updater_id')
  updater!: number;

  // 关联关系
  @ManyToOne(() => User)
  @JoinColumn({ name: 'creator' })
  creatorEntity!: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'updater' })
  updaterEntity!: User;

  @ManyToOne(() => Branch)
  @JoinColumn({ name: 'branch' })
  branchEntity!: Branch;

  @OneToMany(() => TrainingPlan, trainingPlan => trainingPlan.creator)
  created_training_plans!: TrainingPlan[];

  async validatePassword(password: string, dbPassword: string): Promise<boolean> {
    return md5.default(password) === dbPassword;
  }
}