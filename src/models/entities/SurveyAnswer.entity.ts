import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { SurveySubmission } from './SurveySubmission.entity';
import { SurveyQuestion } from './SurveyQuestion.entity';
import { SurveyQuestionOption } from './SurveyQuestionOption.entity';

@Entity('survey_answers')
export class SurveyAnswer {
  @PrimaryGeneratedColumn()
  _id!: number;

  @Column({ type: 'int', comment: '提交记录ID' })
  submission_id!: number;

  @Column({ type: 'int', comment: '问题ID' })
  question_id!: number;

  @Column({ type: 'int', nullable: true, comment: '选项ID，选择题时使用' })
  option_id?: number;

  @Column({ type: 'text', nullable: true, comment: '答案内容，填空题和简答题时使用' })
  answer_text?: string;

  @Column({ type: 'int', default: 0, comment: '是否删除：0-未删除，1-已删除' })
  is_deleted!: number;

  @CreateDateColumn({ type: 'timestamp', comment: '创建时间' })
  created_time!: Date;

  @UpdateDateColumn({ type: 'timestamp', comment: '更新时间' })
  updated_time!: Date;

  // 关联关系
  @ManyToOne(() => SurveySubmission, submission => submission.answers)
  @JoinColumn({ name: 'submission_id' })
  submission!: SurveySubmission;

  @ManyToOne(() => SurveyQuestion, question => question.answers)
  @JoinColumn({ name: 'question_id' })
  question!: SurveyQuestion;

  @ManyToOne(() => SurveyQuestionOption)
  @JoinColumn({ name: 'option_id' })
  option!: SurveyQuestionOption;
}