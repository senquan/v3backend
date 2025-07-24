import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { User } from './User.entity';
import { SurveyQuestion } from './SurveyQuestion.entity';
import { SurveySubmission } from './SurveySubmission.entity';

@Entity('surveys')
export class Survey {
  @PrimaryGeneratedColumn()
  _id!: number;

  @Column({ type: 'varchar', length: 100, comment: '问卷标题' })
  title!: string;

  @Column({ type: 'text', nullable: true, comment: '问卷描述' })
  description?: string;

  @Column({ type: 'int', comment: '问卷分类：1-满意度调查，2-培训反馈，3-需求调研，4-其他' })
  category!: number;

  @Column({ type: 'int', default: 0, comment: '状态：0-草稿，1-发布，2-已结束' })
  status!: number;

  @Column({ type: 'timestamp', nullable: true, comment: '开始时间' })
  start_time?: Date;

  @Column({ type: 'timestamp', nullable: true, comment: '结束时间' })
  end_time?: Date;

  @Column({ type: 'int', default: 0, comment: '是否匿名：0-实名，1-匿名' })
  is_anonymous!: number;

  @Column({ type: 'int', nullable: true, comment: '最大提交数量，null表示不限制' })
  max_submissions?: number;

  @Column({ type: 'int', default: 0, comment: '提交数量' })
  submission_count!: number;

  @Column({ type: 'int', default: 0, comment: '查看次数' })
  view_count!: number;

  @Column({ type: 'int', comment: '创建者ID' })
  creator!: number;

  @Column({ type: 'int', nullable: true, comment: '更新者ID' })
  updater?: number;

  @Column({ type: 'int', default: 0, comment: '是否删除：0-未删除，1-已删除' })
  is_deleted!: number;

  @CreateDateColumn({ type: 'timestamp', comment: '创建时间' })
  created_time!: Date;

  @UpdateDateColumn({ type: 'timestamp', comment: '更新时间' })
  updated_time!: Date;

  // 关联关系
  @ManyToOne(() => User)
  @JoinColumn({ name: 'creator' })
  creatorEntity!: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'updater' })
  updaterEntity!: User;

  @OneToMany(() => SurveyQuestion, question => question.survey)
  questions!: SurveyQuestion[];

  @OneToMany(() => SurveySubmission, submission => submission.survey)
  submissions!: SurveySubmission[];
}