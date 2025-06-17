import { CreateDateColumn, Entity, PrimaryGeneratedColumn, Column, JoinColumn, ManyToOne } from "typeorm";
import { Exam } from "./Exam.entity";
import { Question } from "./Question.entity";

@Entity("tr_exam_questions")
export class ExamQuestion {
  @PrimaryGeneratedColumn()
  _id!: number;

  @Column({ type: "integer", nullable: false, comment: "试卷ID" })
  exam_id!: number;

  @Column({ type: "integer", nullable: false, comment: "题目ID" })
  question_id!: number;

  @Column({ type: "numeric", precision: 5, scale: 2, nullable: false, comment: "题目分值" })
  question_score!: number;

  @Column({ type: "integer", nullable: true, comment: "题目顺序" })
  question_order: number | null = null;

  @CreateDateColumn({ name: "create_time" })
  create_time!: Date;

  // 关联关系
  @ManyToOne(() => Exam, exam => exam.examQuestions, { onDelete: "CASCADE" })
  @JoinColumn({ name: "exam_id" })
  examEntity!: Exam;

  @ManyToOne(() => Question)
  @JoinColumn({ name: "question_id" })
  questionEntity!: Question;
}