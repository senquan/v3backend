import { CreateDateColumn, Entity, PrimaryGeneratedColumn, Column, JoinColumn, ManyToOne } from "typeorm";
import { ExamRecord } from "./ExamRecord.entity";
import { Question } from "./Question.entity";

@Entity("tr_exam_answers")
export class ExamAnswer {
  @PrimaryGeneratedColumn()
  _id!: number;

  @Column({ type: "integer", nullable: false, comment: "考试记录ID" })
  exam_record_id!: number;

  @Column({ type: "integer", nullable: true, comment: "题目ID" })
  question_id: number | null = null;

  @Column({ type: "text", nullable: true, comment: "用户答案" })
  user_answer: string | null = null;

  @Column({ type: "boolean", nullable: true, comment: "是否正确" })
  is_correct: boolean | null = null;

  @Column({ type: "numeric", precision: 5, scale: 2, nullable: true, comment: "得分" })
  score: number | null = null;

  @CreateDateColumn({ name: "created_at" })
  created_at!: Date;

  // 关联关系
  @ManyToOne(() => ExamRecord, examRecord => examRecord.examAnswers, { onDelete: "CASCADE" })
  @JoinColumn({ name: "exam_record_id" })
  examRecordEntity!: ExamRecord;

  @ManyToOne(() => Question)
  @JoinColumn({ name: "question_id" })
  questionEntity!: Question;
}