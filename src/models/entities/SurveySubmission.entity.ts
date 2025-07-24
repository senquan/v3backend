import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Survey } from './Survey.entity';
import { User } from './User.entity';
import { SurveyAnswer } from './SurveyAnswer.entity';

@Entity('survey_submissions')
export class SurveySubmission {
  @PrimaryGeneratedColumn()
  _id!: number;

  @Column({ type: 'int', comment: '问卷ID' })
  survey_id!: number;

  @Column({ type: 'int', nullable: true, comment: '提交者ID，匿名问卷时为null' })
  user_id?: number;

  @Column({ type: 'varchar', length: 50, nullable: true, comment: '提交者姓名，匿名问卷时可为空' })
  user_name?: string;

  @Column({ type: 'varchar', length: 100, nullable: true, comment: '提交者邮箱' })
  user_email?: string;

  @Column({ type: 'varchar', length: 20, nullable: true, comment: '提交者电话' })
  user_phone?: string;

  @Column({ type: 'varchar', length: 45, nullable: true, comment: '提交者IP地址' })
  ip_address?: string;

  @Column({ type: 'text', nullable: true, comment: '用户代理信息' })
  user_agent?: string;

  @Column({ type: 'int', default: 1, comment: '提交状态：1-已提交，2-草稿' })
  status!: number;

  @Column({ type: 'int', default: 0, comment: '是否删除：0-未删除，1-已删除' })
  is_deleted!: number;

  @CreateDateColumn({ type: 'timestamp', comment: '创建时间' })
  created_time!: Date;

  @UpdateDateColumn({ type: 'timestamp', comment: '更新时间' })
  updated_time!: Date;

  // 关联关系
  @ManyToOne(() => Survey, survey => survey.submissions)
  @JoinColumn({ name: 'survey_id' })
  survey!: Survey;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @OneToMany(() => SurveyAnswer, answer => answer.submission)
  answers!: SurveyAnswer[];
}