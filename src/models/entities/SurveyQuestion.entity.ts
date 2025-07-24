import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Survey } from './Survey.entity';
import { SurveyQuestionOption } from './SurveyQuestionOption.entity';
import { SurveyAnswer } from './SurveyAnswer.entity';

@Entity('survey_questions')
export class SurveyQuestion {
  @PrimaryGeneratedColumn()
  _id!: number;

  @Column({ type: 'int', comment: '问卷ID' })
  survey_id!: number;

  @Column({ type: 'varchar', length: 200, comment: '问题内容' })
  question_text!: string;

  @Column({ type: 'int', comment: '问题类型：1-单选题，2-多选题，3-填空题，4-简答题' })
  question_type!: number;

  @Column({ type: 'int', default: 0, comment: '是否必填：0-非必填，1-必填' })
  is_required!: number;

  @Column({ type: 'int', comment: '排序' })
  sort_order!: number;

  @Column({ type: 'int', default: 0, comment: '是否删除：0-未删除，1-已删除' })
  is_deleted!: number;

  @CreateDateColumn({ type: 'timestamp', comment: '创建时间' })
  created_time!: Date;

  @UpdateDateColumn({ type: 'timestamp', comment: '更新时间' })
  updated_time!: Date;

  // 关联关系
  @ManyToOne(() => Survey, survey => survey.questions)
  @JoinColumn({ name: 'survey_id' })
  survey!: Survey;

  @OneToMany(() => SurveyQuestionOption, option => option.question)
  options!: SurveyQuestionOption[];

  @OneToMany(() => SurveyAnswer, answer => answer.question)
  answers!: SurveyAnswer[];
}