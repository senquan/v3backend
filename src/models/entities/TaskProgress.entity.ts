import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Task } from './Task.entity';
import { TaskItem } from './TaskItem.entity';
import { User } from './User.entity';

// 进度状态枚举
export enum ProgressStatus {
  NOT_STARTED = 0,  // 未开始
  IN_PROGRESS = 1,  // 进行中
  COMPLETED = 2,    // 已完成
  FAILED = 3,       // 失败
  SKIPPED = 4       // 跳过
}

@Entity('tr_task_progress')
export class TaskProgress {
  @PrimaryGeneratedColumn()
  _id!: number;

  @Column({ type: 'integer', nullable: false, comment: '任务ID' })
  @Index('idx_task_progress_task_id')
  task_id!: number;

  @Column({ type: 'integer', nullable: false, comment: '任务项ID' })
  @Index('idx_task_progress_task_item_id')
  task_item_id!: number;

  @Column({ type: 'integer', nullable: false, comment: '用户ID' })
  @Index('idx_task_progress_user_id')
  user_id!: number;

  @Column({ 
    type: 'enum', 
    enum: ProgressStatus, 
    default: ProgressStatus.NOT_STARTED,
    comment: '进度状态：0-未开始，1-进行中，2-已完成，3-失败，4-跳过'
  })
  status!: ProgressStatus;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0, comment: '完成进度(%)' })
  progress!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0, comment: '获得分数' })
  score!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0, comment: '满分' })
  max_score!: number;

  @Column({ type: 'integer', default: 0, comment: '学习时长(秒)' })
  study_duration!: number;

  @Column({ type: 'integer', default: 0, comment: '尝试次数' })
  attempt_count!: number;

  @Column({ type: 'boolean', default: false, comment: '是否通过' })
  is_passed!: boolean;

  @Column({ type: 'timestamp', nullable: true, comment: '开始时间' })
  start_time: Date | null = null;

  @Column({ type: 'timestamp', nullable: true, comment: '完成时间' })
  completion_time: Date | null = null;

  @Column({ type: 'timestamp', nullable: true, comment: '最后访问时间' })
  last_access_time: Date | null = null;

  @Column({ type: 'integer', default: 0, comment: '访问次数' })
  access_count!: number;

  @Column({ type: 'json', nullable: true, comment: '详细进度数据(JSON格式)' })
  progress_data: any = null;

  @Column({ type: 'json', nullable: true, comment: '答题记录(JSON格式)' })
  answer_records: any = null;

  @Column({ type: 'text', nullable: true, comment: '学习笔记' })
  notes: string | null = null;

  @Column({ type: 'text', nullable: true, comment: '反馈意见' })
  feedback: string | null = null;

  @Column({ type: 'integer', default: 1, comment: '评分(1-5星)' })
  rating!: number;

  @Column({ type: 'text', nullable: true, comment: '失败原因' })
  failure_reason: string | null = null;

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

  // 关联关系
  @ManyToOne(() => Task, {
    createForeignKeyConstraints: false
  })
  @JoinColumn({ name: 'task_id' })
  task!: Task;

  @ManyToOne(() => TaskItem, {
    createForeignKeyConstraints: false
  })
  @JoinColumn({ name: 'task_item_id' })
  taskItem!: TaskItem;

  @ManyToOne(() => User, {
    createForeignKeyConstraints: false
  })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  // 复合索引
  @Index('idx_task_progress_composite', ['task_id', 'user_id'])
  static compositeIndex: any;

  @Index('idx_task_progress_item_user', ['task_item_id', 'user_id'])
  static itemUserIndex: any;
}