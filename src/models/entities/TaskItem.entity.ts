import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Task } from './Task.entity';
import { Courseware } from './Courseware.entity';
import { Exam } from './Exam.entity';
import { User } from './User.entity';

// 任务项类型枚举
export enum TaskItemType {
  COURSEWARE = 1,   // 课件学习
  EXAM = 2,         // 考试
  SURVEY = 3,       // 问卷
  CHECKIN = 4,      // 签到
  HOMEWORK = 5,     // 作业
  LIVE = 6,         // 直播
  EXTERNAL = 7      // 外部链接
}

// 任务项状态枚举
export enum TaskItemStatus {
  INACTIVE = 0,     // 未激活
  ACTIVE = 1,       // 激活
  DISABLED = 2      // 禁用
}

@Entity('tr_task_items')
export class TaskItem {
  @PrimaryGeneratedColumn()
  _id!: number;

  @Column({ type: 'integer', nullable: false, comment: '任务ID' })
  @Index('idx_task_items_task_id')
  task_id!: number;

  @Column({ type: 'varchar', length: 200, nullable: false, comment: '任务项标题' })
  title!: string;

  @Column({ type: 'text', nullable: true, comment: '任务项描述' })
  description: string | null = null;

  @Column({ 
    type: 'enum', 
    enum: TaskItemType, 
    default: TaskItemType.COURSEWARE,
    comment: '任务项类型：1-课件学习，2-考试，3-问卷，4-签到，5-作业，6-直播，7-外部链接'
  })
  item_type!: TaskItemType;

  @Column({ 
    type: 'enum', 
    enum: TaskItemStatus, 
    default: TaskItemStatus.ACTIVE,
    comment: '任务项状态：0-未激活，1-激活，2-禁用'
  })
  status!: TaskItemStatus;

  @Column({ type: 'integer', nullable: true, comment: '关联的课件ID' })
  @Index('idx_task_items_courseware_id')
  courseware_id: number | null = null;

  @Column({ type: 'integer', nullable: true, comment: '关联的考试ID' })
  @Index('idx_task_items_exam_id')
  exam_id: number | null = null;

  @Column({ type: 'integer', nullable: true, comment: '关联的问卷ID' })
  @Index('idx_task_items_survey_id')
  survey_id: number | null = null;

  @Column({ type: 'varchar', length: 500, nullable: true, comment: '外部链接URL' })
  external_url: string | null = null;

  @Column({ type: 'integer', default: 1, comment: '排序序号' })
  sort_order!: number;

  @Column({ type: 'boolean', default: true, comment: '是否必须完成' })
  is_required!: boolean;

  @Column({ type: 'integer', default: 0, comment: '学习时长要求(分钟)' })
  required_duration!: number;

  @Column({ type: 'integer', default: 0, comment: '及格分数(适用于考试)' })
  pass_score!: number;

  @Column({ type: 'integer', default: 1, comment: '最大尝试次数' })
  max_attempts!: number;

  @Column({ type: 'timestamp', nullable: true, comment: '项目开始时间' })
  start_time: Date | null = null;

  @Column({ type: 'timestamp', nullable: true, comment: '项目结束时间' })
  end_time: Date | null = null;

  @Column({ type: 'json', nullable: true, comment: '项目配置(JSON格式)' })
  item_config: any = null;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0, comment: '权重(用于计算总分)' })
  weight!: number;

  @Column({ type: 'text', nullable: true, comment: '完成条件描述' })
  completion_criteria: string | null = null;

  @Column({ type: 'text', nullable: true, comment: '备注' })
  remark: string | null = null;

  @Column({ type: 'integer', default: 0, comment: '是否删除：0-未删除，1-已删除' })
  is_deleted!: number;

  @CreateDateColumn({ comment: '创建时间' })
  created_time!: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updated_time!: Date;

  @Column({ type: 'integer', nullable: false, comment: '创建人ID' })
  @Index('idx_task_items_creator')
  creator!: number;

  @Column({ type: 'integer', nullable: true, comment: '更新人ID' })
  @Index('idx_task_items_updater')
  updater: number | null = null;

  // 关联关系
  @ManyToOne(() => Task, task => task.taskItems, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task!: Task;

  @ManyToOne(() => Courseware, {
    createForeignKeyConstraints: false
  })
  @JoinColumn({ name: 'courseware_id' })
  courseware!: Courseware;

  @ManyToOne(() => Exam, {
    createForeignKeyConstraints: false
  })
  @JoinColumn({ name: 'exam_id' })
  exam!: Exam;

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
}