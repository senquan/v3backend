import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from './User.entity';
import { Branch } from './Branch.entity';
import { Project } from './Project.entity';

@Entity({ 
  name: 'construction_worker',
  schema: 'crscs' 
})
export class ConstructionWorker {
  @PrimaryGeneratedColumn()
  _id!: number;

  @Column({ type: 'varchar', length: 50, nullable: false })
  name!: string;

  @Column({ type: 'integer', nullable: true })
  @Index('idx_construction_worker_branch')
  branch: number | null = null;

  @Column({ type: 'integer', nullable: true })
  @Index('idx_construction_worker_project')
  project: number | null = null;

  @Column({ type: 'smallint', nullable: true })
  employee_type: number | null = null;

  @Column({ type: 'boolean', nullable: true })
  sex: boolean | null = null;

  @Column({ type: 'smallint', default: 90 })
  status!: number;

  @Column({ type: 'text', nullable: true })
  notes: string | null = null;

  @Column({ type: 'integer', nullable: true })
  creator_id: number | null = null;

  @CreateDateColumn()
  create_time!: Date;

  @Column({ type: 'integer', nullable: true })
  updater_id: number | null = null;

  @UpdateDateColumn()
  update_time!: Date;

  // 关联关系
  @ManyToOne(() => Branch)
  @JoinColumn({ name: 'branch' })
  branchEntity!: Branch;

  @ManyToOne(() => Project)
  @JoinColumn({ name: 'project' })
  projectEntity!: Project;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'creator_id' })
  creator!: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'updater_id' })
  updater!: User;
}