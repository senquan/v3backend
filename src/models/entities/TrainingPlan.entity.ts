import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import { User } from './User.entity';
import { TrainingPlanScope } from './TrainingPlanScope.entity';

@Entity('tr_training_plans')
export class TrainingPlan {
  @PrimaryGeneratedColumn()
  _id!: number;

  @Column({ type: 'varchar', length: 100, nullable: false })
  name!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  trainer: string | null = null;

  @Column({ type: 'smallint', default: 0 })
  training_mode!: number;

  @Column({ type: 'smallint', default: 0 })
  training_category!: number;

  @Column({ type: 'integer', default: 0 })
  planned_participants!: number;

  @Column({ type: 'timestamp', nullable: true })
  planned_time: Date | null = null;

  @Column({ type: 'decimal', precision: 5, scale: 1, default: 0  })
  training_hours!: number;

  @Column({ type: 'smallint', default: 0 })
  assessment_method!: number;

  @Column({ type: 'smallint', default: 0 })
  exam_method!: number;

  @Column({ type: 'integer', default: 0 })
  status!: number;

  @Column({ type: 'integer', default: 0 })
  is_deleted!: number;

  @CreateDateColumn()
  created_time!: Date;

  @UpdateDateColumn()
  updated_time!: Date;

  // 关联关系
  @ManyToOne(() => User)
  @JoinColumn()
  creator!: User;

  @ManyToOne(() => User)
  @JoinColumn()
  updater!: User;

  @OneToMany(() => TrainingPlanScope, scope => scope.training_plan)
  scopes!: TrainingPlanScope[];
}