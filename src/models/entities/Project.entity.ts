import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import { User } from './User.entity';
import { ProjectDepartmentMember } from './ProjectDepartmentMember.entity';
import { Branch } from './Branch.entity';

@Entity({ 
  name: 'project',
  schema: 'crscs' 
})
export class Project {
  @PrimaryGeneratedColumn()
  _id!: number;

  @Column({ type: 'varchar', length: 100, nullable: false })
  name!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  abbreviation: string | null = null;

  @Column({ type: 'varchar', length: 50, unique: true, nullable: true })
  code!: string;

  @Column({ type: 'integer', nullable: true })
  @Index('idx_project_department_members_branch')
  branch!: number;

  @Column({ type: 'smallint', default: 1 })
  status!: number;

  @Column({ type: 'smallint', nullable: true })
  grade: number | null = null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  project_manager_name: string | null = null;

  @Column({ type: 'integer', nullable: true })
  project_department_members: number | null = null;

  @Column({ type: 'integer', nullable: true })
  creator: number | null = null;

  @CreateDateColumn()
  create_time!: Date;

  @Column({ type: 'integer', nullable: true })
  updater: number | null = null;

  @UpdateDateColumn()
  update_time!: Date;

  // 关联关系
  @ManyToOne(() => Branch)
  @JoinColumn({ name: 'branch' })
  branchEntity!: Branch;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'creator' })
  creatorEntity!: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'updater' })
  updaterEntity!: User;

  @OneToMany(() => ProjectDepartmentMember, member => member._parent)
  members!: ProjectDepartmentMember[];
}