import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from "typeorm";
import { User } from "./User.entity";
import { StudyCourseware } from "./StudyCourseware.entity";
// import { MockExam } from "./MockExam.entity";
// import { StudyExamRecord } from "./StudyExamRecord.entity";

@Entity("tr_study_plans")
export class StudyPlan {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 100, nullable: false, comment: "计划标题" })
  title!: string;

  @Column({ type: "text", nullable: true, comment: "计划描述" })
  description: string | null = null;

  @Column({ type: "smallint", nullable: false, comment: "学习分类" })
  category!: number;

  @Column({ type: "smallint", nullable: false, comment: "难度级别" })
  level!: number;

  @Column({ type: "decimal", precision: 5, scale: 1, default: 0, comment: "计划学习时长(小时)" })
  study_hours!: number;

  @Column({ type: "integer", default: 60, comment: "目标分数" })
  target_score!: number;

  @Column({ type: "smallint", default: 0, comment: "计划状态：0-未开始，1-进行中，2-已完成，3-已暂停" })
  status!: number;

  @Column({ type: "decimal", precision: 5, scale: 2, default: 0, comment: "学习进度(百分比)" })
  progress!: number;

  @Column({ type: "timestamp", nullable: true, comment: "计划开始时间" })
  start_time: Date | null = null;

  @Column({ type: "timestamp", nullable: true, comment: "计划结束时间" })
  end_time: Date | null = null;

  @Column({ type: "timestamp", nullable: true, comment: "实际完成时间" })
  completed_time: Date | null = null;

  @Column({ type: "text", nullable: true, comment: "学习目标" })
  objectives: string | null = null;

  @Column({ type: "text", nullable: true, comment: "学习要求" })
  requirements: string | null = null;

  @Column({ type: "integer", nullable: false, comment: "创建人" })
  creator!: number;

  @Column({ type: "integer", nullable: true, comment: "更新人" })
  updater: number | null = null;

  @Column({ type: "smallint", default: 0, comment: "是否删除：0-否，1-是" })
  is_deleted!: number;

  @CreateDateColumn({ name: "create_time" })
  create_time!: Date;

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

  @OneToMany(() => StudyCourseware, courseware => courseware.studyPlan)
  coursewares!: StudyCourseware[];

  // @OneToMany(() => MockExam, exam => exam.studyPlan)
  // mockExams!: MockExam[];

  // @OneToMany(() => StudyExamRecord, record => record.studyPlan)
  // examRecords!: StudyExamRecord[];
}