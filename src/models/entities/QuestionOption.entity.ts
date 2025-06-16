import { Entity, PrimaryGeneratedColumn, Column, JoinColumn, ManyToOne } from "typeorm";
import { Question } from "./Question.entity";

@Entity("question_options")
export class QuestionOption {
  @PrimaryGeneratedColumn()
  _id!: number;

  @Column({ type: "integer", nullable: false, comment: "题目ID" })
  question_id!: number;

  @Column({ type: "varchar", length: 10, nullable: false, comment: "选项标签：A, B, C, D..." })
  option_label!: string;

  @Column({ type: "text", nullable: false, comment: "选项内容" })
  option_content!: string;

  @Column({ type: "boolean", default: false, comment: "是否为正确选项" })
  is_correct!: boolean;

  // 关联关系
  @ManyToOne(() => Question, question => question.options, { onDelete: "CASCADE" })
  @JoinColumn({ name: "question_id" })
  questionEntity!: Question;
}