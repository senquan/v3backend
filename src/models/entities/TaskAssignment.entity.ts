import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Task } from './Task.entity';
import { User } from './User.entity';
import { Branch } from './Branch.entity';

// 分配类型枚举
export enum AssignmentType {
  USER = 1,         // 分配给用户
  DEPARTMENT = 2,   // 分配给部门
  ROLE = 3,         // 分配给角色
  ALL = 4           // 分配给所有人
}

// 分配状态枚举
export enum AssignmentStatus {
  PENDING = 0,      // 待开始
  IN_PROGRESS = 1,  // 进行中
  COMPLETED = 2,    // 已完成
  OVERDUE = 3,      // 已逾期
  EXEMPTED = 4      // 已免除
}

@Entity('tr_task_assignments')
export class TaskAssignment {
  @PrimaryGeneratedColumn()
  _id!: number;

  @Column({ type: 'integer', nullable: false, comment: '任务ID' })
  @Index('idx_task_assignments_task_id')
  task_id!: number;

  @Column({ 
    type: 'enum', 
    enum: AssignmentType, 
    default: AssignmentType.USER,
    comment: '分配类型：1-用户，2-部门，3-角色，4-所有人'
  })
  assignment_type!: AssignmentType;

  @Column({ type: 'integer', nullable: true, comment: '分配目标用户ID' })
  @Index('idx_task_assignments_user_id')
  user_id: number | null = null;

  @Column({ type: 'integer', nullable: true, comment: '分配目标部门ID' })
  @Index('idx_task_assignments_department_id')
  department_id: number | null = null;

  @Column({ type: 'varchar', length: 100, nullable: true, comment: '分配目标角色' })
  role_name: string | null = null;

  @Column({ 
    type: 'enum', 
    enum: AssignmentStatus, 
    default: AssignmentStatus.PENDING,
    comment: '分配状态：0-待开始，1-进行中，2-已完成，3-已逾期，4-已免除'
  })
  status!: AssignmentStatus;

  @Column({ type: 'timestamp', nullable: true, comment: '开始时间' })
  start_time: Date | null = null;

  @Column({ type: 'timestamp', nullable: true, comment: '完成时间' })
  completion_time: Date | null = null;

  @Column({ type: 'timestamp', nullable: true, comment: '截止时间' })
  deadline: Date | null = null;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0, comment: '完成进度(%)' })
  progress!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0, comment: '总分数' })
  total_score!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0, comment: '获得分数' })
  achieved_score!: number;

  @Column({ type: 'integer', default: 0, comment: '学习时长(分钟)' })
  study_duration!: number;

  @Column({ type: 'integer', default: 0, comment: '尝试次数' })
  attempt_count!: number;

  @Column({ type: 'boolean', default: false, comment: '是否通过' })
  is_passed!: boolean;

  @Column({ type: 'boolean', default: false, comment: '是否免除' })
  is_exempted!: boolean;

  @Column({ type: 'text', nullable: true, comment: '免除原因' })
  exemption_reason: string | null = null;

  @Column({ type: 'timestamp', nullable: true, comment: '最后访问时间' })
  last_access_time: Date | null = null;

  @Column({ type: 'json', nullable: true, comment: '扩展数据(JSON格式)' })
  extra_data: any = null;

  @Column({ type: 'text', nullable: true, comment: '备注' })
  remark: string | null = null;

  @Column({ type: 'integer', default: 0, comment: '是否删除：0-未删除，1-已删除' })
  is_deleted!: number;

  @CreateDateColumn({ comment: '创建时间' })
  created_time!: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updated_time!: Date;

  @Column({ type: 'integer', nullable: false, comment: '分配人ID' })
  @Index('idx_task_assignments_assigner')
  assigner!: number;

  @Column({ type: 'integer', nullable: true, comment: '更新人ID' })
  @Index('idx_task_assignments_updater')
  updater: number | null = null;

  // 关联关系
  @ManyToOne(() => Task, task => task.taskAssignments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task!: Task;

  @ManyToOne(() => User, {
    createForeignKeyConstraints: false
  })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => Branch, {
    createForeignKeyConstraints: false
  })
  @JoinColumn({ name: 'department_id' })
  department!: Branch;

  @ManyToOne(() => User, {
    createForeignKeyConstraints: false
  })
  @JoinColumn({ name: 'assigner' })
  assignerEntity!: User;

  @ManyToOne(() => User, {
    createForeignKeyConstraints: false
  })
  @JoinColumn({ name: 'updater' })
  updaterEntity!: User;
}