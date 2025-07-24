import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import { User } from './User.entity';
import { TaskItem } from './TaskItem.entity';
import { TaskAssignment } from './TaskAssignment.entity';

// 任务状态枚举
export enum TaskStatus {
  DRAFT = 0,        // 草稿
  PUBLISHED = 1,    // 已发布
  IN_PROGRESS = 2,  // 进行中
  COMPLETED = 3,    // 已完成
  CANCELLED = 4     // 已取消
}

// 任务类型枚举
export enum TaskType {
  TRAINING = 1,     // 培训任务
  EXAM = 2,         // 考试任务
  SURVEY = 3,       // 问卷任务
  CHECKIN = 4,      // 签到任务
  HOMEWORK = 5,     // 作业任务
  LIVE = 6,         // 直播任务
  MIXED = 7         // 混合任务
}

// 任务优先级枚举
export enum TaskPriority {
  LOW = 1,          // 低
  NORMAL = 2,       // 普通
  HIGH = 3,         // 高
  URGENT = 4        // 紧急
}

@Entity('tr_tasks')
export class Task {
  @PrimaryGeneratedColumn()
  _id!: number;

  @Column({ type: 'varchar', length: 200, nullable: false, comment: '任务标题' })
  title!: string;

  @Column({ type: 'text', nullable: true, comment: '任务描述' })
  description: string | null = null;

  @Column({ 
    type: 'enum', 
    enum: TaskType, 
    default: TaskType.TRAINING,
    comment: '任务类型：1-培训任务，2-考试任务，3-问卷任务，4-签到任务，5-作业任务，6-直播任务，7-混合任务'
  })
  task_type!: TaskType;

  @Column({ 
    type: 'enum', 
    enum: TaskPriority, 
    default: TaskPriority.NORMAL,
    comment: '任务优先级：1-低，2-普通，3-高，4-紧急'
  })
  priority!: TaskPriority;

  @Column({ 
    type: 'enum', 
    enum: TaskStatus, 
    default: TaskStatus.DRAFT,
    comment: '任务状态：0-草稿，1-已发布，2-进行中，3-已完成，4-已取消'
  })
  status!: TaskStatus;

  @Column({ type: 'timestamp', nullable: true, comment: '任务开始时间' })
  start_time: Date | null = null;

  @Column({ type: 'timestamp', nullable: true, comment: '任务结束时间' })
  end_time: Date | null = null;

  @Column({ type: 'timestamp', nullable: true, comment: '任务发布时间' })
  publish_time: Date | null = null;

  @Column({ type: 'integer', default: 0, comment: '预计参与人数' })
  expected_participants!: number;

  @Column({ type: 'integer', default: 0, comment: '实际参与人数' })
  actual_participants!: number;

  @Column({ type: 'integer', default: 0, comment: '完成人数' })
  completed_participants!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0, comment: '完成率(%)' })
  completion_rate!: number;

  @Column({ type: 'boolean', default: false, comment: '是否允许补交' })
  allow_makeup!: boolean;

  @Column({ type: 'boolean', default: false, comment: '是否自动分配' })
  auto_assign!: boolean;

  @Column({ type: 'json', nullable: true, comment: '自动分配规则(JSON格式)' })
  auto_assign_rules: any = null;

  @Column({ type: 'json', nullable: true, comment: '任务配置(JSON格式)' })
  task_config: any = null;

  @Column({ type: 'varchar', length: 500, nullable: true, comment: '任务标签' })
  tags: string | null = null;

  @Column({ type: 'text', nullable: true, comment: '备注' })
  remark: string | null = null;

  @Column({ type: 'integer', default: 0, comment: '是否删除：0-未删除，1-已删除' })
  is_deleted!: number;

  @CreateDateColumn({ comment: '创建时间' })
  created_time!: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updated_time!: Date;

  @Column({ type: 'integer', nullable: false, comment: '创建人ID' })
  @Index('idx_tasks_creator')
  creator!: number;

  @Column({ type: 'integer', nullable: true, comment: '更新人ID' })
  @Index('idx_tasks_updater')
  updater: number | null = null;

  // 关联关系
  @ManyToOne(() => User, {
    createForeignKeyConstraints: false
  })
  @JoinColumn({ name: 'creator' })
  creatorEntity!: User;

  @ManyToOne(() => User, {
    createForeignKeyConstraints: false
  })
  @JoinColumn({ name: 'updater' })
  updaterEntity!: User;

  @OneToMany(() => TaskItem, taskItem => taskItem.task)
  taskItems!: TaskItem[];

  @OneToMany(() => TaskAssignment, taskAssignment => taskAssignment.task)
  taskAssignments!: TaskAssignment[];
}