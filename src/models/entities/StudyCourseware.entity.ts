import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { Courseware } from "./Courseware.entity";
import { StudyPlan } from "./StudyPlan.entity";
import { User } from "./User.entity";

@Entity("tr_study_coursewares")
export class StudyCourseware {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "integer", nullable: false, comment: "关联的学习计划ID" })
  study_plan_id!: number;

  @Column({ type: "integer", nullable: false, comment: "关联的学习课件ID" })
  courseware_id!: number;

  @Column({ type: 'integer', default: 0 })
  progress!: number;

  @Column({ type: "integer", nullable: false, comment: "创建人" })
  creator!: number;

  @CreateDateColumn({ name: "create_time" })
  create_time!: Date;

  @UpdateDateColumn({ name: "update_time" })
  update_time!: Date;

  // 关联关系
  @ManyToOne(() => StudyPlan, plan => plan.coursewares)
  @JoinColumn({ name: "study_plan_id" })
  studyPlan!: StudyPlan;

  @ManyToOne(() => Courseware)
  @JoinColumn({ name: "courseware_id" })
  courseware!: Courseware;

  @ManyToOne(() => User, {
    createForeignKeyConstraints: false
  })
  @JoinColumn({ name: "creator" })
  creatorEntity!: User;
}