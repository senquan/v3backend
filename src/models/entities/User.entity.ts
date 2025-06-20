import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
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

  @Column({ type: 'varchar', length: 10, nullable: true })
  gender: string | null = null;

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

  @Column({ type: 'integer', nullable: true })
  entrance: number | null = null;

  @Column({ type: 'text', nullable: true })
  notes: string | null = null;

  @Column({ type: 'integer', default: 0 })
  failed!: number;

  @CreateDateColumn({ nullable: true })
  password_modify_date: Date | null = null;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  // 关联关系
  @ManyToOne(() => User)
  @JoinColumn()
  creator!: User;

  @ManyToOne(() => User)
  @JoinColumn()
  updater!: User;

  @ManyToOne(() => Branch)
  @JoinColumn({ name: 'branch' })
  branchEntity!: Branch;

  @OneToMany(() => TrainingPlan, trainingPlan => trainingPlan.creator)
  created_training_plans!: TrainingPlan[];
}