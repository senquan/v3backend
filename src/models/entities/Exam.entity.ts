import { CreateDateColumn, Entity, PrimaryGeneratedColumn, Column, JoinColumn, OneToMany, ManyToOne, UpdateDateColumn } from "typeorm";
import { User } from "./User.entity";
import { Category } from "./Category.entity";
import { ExamQuestion } from "./ExamQuestion.entity";
import { ExamRecord } from "./ExamRecord.entity";

@Entity("tr_exams")
export class Exam {
  @PrimaryGeneratedColumn()
  _id!: number;

  @Column({ type: "varchar", length: 100, nullable: false, comment: "试卷标题" })
  title!: string;

  @Column({ type: "text", nullable: true, comment: "试卷描述" })
  description: string | null = null;

  @Column({ type: "smallint", nullable: true, comment: "考试类型" })
  type: number | null = null;

  @Column({ type: "integer", nullable: true, comment: "考试分类" })
  category_id: number | null = null;

  @Column({ type: "smallint", nullable: true, comment: "培训分类" })
  training_category: number | null = null;

  @Column({ type: "smallint", nullable: true, comment: "考试级别" })
  level: number | null = null;

  @Column({ type: "integer", default: 100, comment: "总分" })
  total_score!: number;

  @Column({ type: "integer", default: 60, comment: "及格分数" })
  pass_score!: number;

  @Column({ type: "integer", nullable: true, comment: "考试时长(分钟)" })
  duration: number | null = null;

  @Column({ type: "boolean", default: true, comment: "状态：启用/禁用" })
  status!: boolean;

  @Column({ type: "integer", nullable: true, comment: "创建人" })
  creator: number | null = null;

  @CreateDateColumn({ name: "create_time" })
  create_time!: Date;

  @Column({ type: "integer", nullable: true, comment: "更新人" })
  updater: number | null = null;

  @UpdateDateColumn({ name: "update_time" })
  update_time!: Date;

  // 关联关系
  @ManyToOne(() => User, {
    createForeignKeyConstraints: false
  })
  @JoinColumn({ name: "creator" })
  creatorEntity!: User;

  @ManyToOne(() => User, {
    createForeignKeyConstraints: false
  })
  @JoinColumn({ name: "updater" })
  updaterEntity!: User;

  @OneToMany(() => ExamQuestion, examQuestion => examQuestion.examEntity)
  examQuestions!: ExamQuestion[];

  @OneToMany(() => ExamRecord, examRecord => examRecord.examEntity)
  examRecords!: ExamRecord[];
}