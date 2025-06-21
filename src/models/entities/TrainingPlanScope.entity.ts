import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { TrainingPlan } from './TrainingPlan.entity';
import { Branch } from './Branch.entity';
import { Project } from './Project.entity';

enum ScopeRefType {
  BRANCH = 1,
  PROJECT_DEPARTMENT = 2
}

@Entity('tr_training_plan_scopes')
export class TrainingPlanScope {
  @PrimaryGeneratedColumn()
  _id!: number;

  @Column({ type: 'integer', nullable: false })
  @Index('idx_training_plan_scopes_training_plan_id')
  training_plan_id!: number;

  @Column({
    type: 'enum', 
    enum: ScopeRefType, 
    default: ScopeRefType.BRANCH 
  })
  ref_type!: ScopeRefType;

  @Column({ type: 'integer', nullable: true })
  @Index('idx_training_plan_scopes_branch_id')
  branch_id: number | null = null;

  @Column({ type: 'integer', nullable: true })
  @Index('idx_training_plan_scopes_project_department_id')
  project_department_id: number | null = null;

  @CreateDateColumn()
  created_at!: Date;

  // 关联关系
  @ManyToOne(() => TrainingPlan, trainingPlan => trainingPlan.scopes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'training_plan_id' })
  training_plan!: TrainingPlan;

  @ManyToOne(() => Branch, {
    createForeignKeyConstraints: false
  })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch | null = null;

  @ManyToOne(() => Project, {
    createForeignKeyConstraints: false
  })
  @JoinColumn({ name: 'project_department_id' })
  project: Project | null = null;
}