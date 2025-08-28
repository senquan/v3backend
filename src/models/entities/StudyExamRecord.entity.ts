import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { Exam } from "./Exam.entity";
import { User } from "./User.entity";
import { StudyPlan } from "./StudyPlan.entity";

@Entity("tr_study_exam_records")
export class StudyExamRecord {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "integer", nullable: false, comment: "关联的学习计划ID" })
  study_plan_id!: number;

  @Column({ type: "integer", nullable: false, comment: "关联的模拟试卷ID" })
  exam_id!: number;

  @Column({ type: "integer", nullable: false, comment: "考试用户ID" })
  user_id!: number;

  @Column({ type: "integer", default: 0, comment: "得分" })
  score!: number;

  @Column({ type: "integer", default: 0, comment: "总分" })
  total_score!: number;

  @Column({ type: "decimal", precision: 5, scale: 2, default: 0, comment: "得分率" })
  score_rate!: number;

  @Column({ type: "integer", default: 0, comment: "正确题数" })
  correct_count!: number;

  @Column({ type: "integer", default: 0, comment: "错误题数" })
  wrong_count!: number;

  @Column({ type: "integer", default: 0, comment: "总题数" })
  total_count!: number;

  @Column({ type: "integer", nullable: true, comment: "用时(秒)" })
  duration: number | null = null;

  @Column({ type: "smallint", default: 0, comment: "考试状态：0-进行中，1-已完成，2-已超时" })
  status!: number;

  @Column({ type: "boolean", default: false, comment: "是否通过" })
  is_passed!: boolean;

  @Column({ type: "integer", default: 1, comment: "考试次数" })
  attempt_count!: number;

  @Column({ type: "json", nullable: true, comment: "答题详情" })
  answer_details: any = null;

  @Column({ type: "json", nullable: true, comment: "错题分析" })
  wrong_analysis: any = null;

  @Column({ type: "timestamp", nullable: true, comment: "开始时间" })
  start_time: Date | null = null;

  @Column({ type: "timestamp", nullable: true, comment: "结束时间" })
  end_time: Date | null = null;

  @Column({ type: "text", nullable: true, comment: "备注" })
  remark: string | null = null;

  @Column({ type: "smallint", default: 0, comment: "是否删除：0-否，1-是" })
  is_deleted!: number;

  @CreateDateColumn({ name: "create_time" })
  create_time!: Date;

  @UpdateDateColumn({ name: "update_time" })
  update_time!: Date;

  // 关联关系
  @ManyToOne(() => StudyPlan, plan => plan.examRecords)
  @JoinColumn({ name: "study_plan_id" })
  studyPlan!: StudyPlan;

  @ManyToOne(() => Exam)
  @JoinColumn({ name: "exam_id" })
  exam!: Exam;

  @ManyToOne(() => User, {
    createForeignKeyConstraints: false
  })
  @JoinColumn({ name: "user_id" })
  user!: User;
}