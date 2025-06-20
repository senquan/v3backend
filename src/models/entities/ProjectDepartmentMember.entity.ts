import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from './User.entity';
import { Project } from './Project.entity';

@Entity({ 
  name: 'project_department_members',
  schema: 'crscs' 
})
export class ProjectDepartmentMember {
  @PrimaryGeneratedColumn()
  _id!: number;

  @Column({ type: 'integer', nullable: false })
  @Index('idx_project_department_members_parent')
  _parent!: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  seq: string | null = null;

  @Column({ type: 'integer', nullable: false })
  @Index('idx_project_department_members_member')
  member!: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  title: string | null = null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null = null;

  @Column({ type: 'boolean', default: false })
  is_manager!: boolean;

  @Column({ type: 'integer', nullable: true })
  creator_id: number | null = null;

  @CreateDateColumn()
  create_time!: Date;

  @Column({ type: 'integer', nullable: true })
  updater_id: number | null = null;

  @UpdateDateColumn()
  update_time!: Date;

  // 关联关系
  @ManyToOne(() => Project)
  @JoinColumn({ name: '_parent' })
  project!: Project;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'member' })
  memberUser!: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'creator_id' })
  creator!: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'updater_id' })
  updater!: User;
}