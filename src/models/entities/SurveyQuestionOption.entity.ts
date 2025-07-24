import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { SurveyQuestion } from './SurveyQuestion.entity';

@Entity('survey_question_options')
export class SurveyQuestionOption {
  @PrimaryGeneratedColumn()
  _id!: number;

  @Column({ type: 'int', comment: '问题ID' })
  question_id!: number;

  @Column({ type: 'varchar', length: 100, comment: '选项文本' })
  option_text!: string;

  @Column({ type: 'varchar', length: 50, comment: '选项值' })
  option_value!: string;

  @Column({ type: 'int', default: 0, comment: '是否删除：0-未删除，1-已删除' })
  is_deleted!: number;

  @CreateDateColumn({ type: 'timestamp', comment: '创建时间' })
  created_time!: Date;

  @UpdateDateColumn({ type: 'timestamp', comment: '更新时间' })
  updated_time!: Date;

  // 关联关系
  @ManyToOne(() => SurveyQuestion, question => question.options)
  @JoinColumn({ name: 'question_id' })
  question!: SurveyQuestion;
}