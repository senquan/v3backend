import { CreateDateColumn, Entity, PrimaryGeneratedColumn, Column, JoinColumn, OneToMany, ManyToOne, UpdateDateColumn } from "typeorm";
import { Exam } from "./Exam.entity";
import { TrainingRecord } from "./TrainingRecord.entity";
import { User } from "./User.entity";
import { ExamAnswer } from "./ExamAnswer.entity";

@Entity("tr_exam_records")
export class ExamRecord {
  @PrimaryGeneratedColumn()
  _id!: number;

  @Column({ type: "integer", nullable: true, comment: "试卷ID" })
  exam_id: number | null = null;

  @Column({ type: "integer", nullable: true, comment: "关联的培训记录" })
  training_record_id: number | null = null;

  @Column({ type: "integer", nullable: true, comment: "考试人员" })
  user_id: number | null = null;

  @Column({ type: "timestamp", nullable: true, comment: "开始时间" })
  start_time: Date | null = null;

  @Column({ type: "timestamp", nullable: true, comment: "结束时间" })
  end_time: Date | null = null;

  @Column({ type: "numeric", precision: 5, scale: 2, nullable: true, comment: "得分" })
  score: number | null = null;

  @Column({ type: "boolean", nullable: true, comment: "是否通过" })
  is_passed: boolean | null = null;

  @Column({ type: "text", nullable: true, comment: "考试记录备注" })
  notes: string | null = null;

  @CreateDateColumn({ name: "create_time" })
  create_time!: Date;

  @UpdateDateColumn({ name: "update_time" })
  update_time!: Date;

  // 关联关系
  @ManyToOne(() => Exam, exam => exam.examRecords)
  @JoinColumn({ name: "exam_id" })
  examEntity!: Exam;

  @ManyToOne(() => TrainingRecord)
  @JoinColumn({ name: "training_record_id" })
  trainingRecordEntity!: TrainingRecord;

  @ManyToOne(() => User)
  @JoinColumn({ name: "user_id" })
  userEntity!: User;

  @OneToMany(() => ExamAnswer, examAnswer => examAnswer.examRecordEntity)
  examAnswers!: ExamAnswer[];
}