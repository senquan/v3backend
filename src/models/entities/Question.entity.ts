import { CreateDateColumn, Entity, PrimaryGeneratedColumn, Column, JoinColumn, OneToMany, ManyToOne, UpdateDateColumn } from "typeorm";
import { User } from "./User.entity";
import { QuestionOption } from "./QuestionOption.entity";

@Entity("questions")
export class Question {
  @PrimaryGeneratedColumn()
  _id!: number;

  @Column({ type: "integer", nullable: true, comment: "考试分类" })
  category_id: number | null = null;

  @Column({ type: "smallint", nullable: true, comment: "培训分类" })
  training_category: number | null = null;

  @Column({ type: "varchar", length: 20, nullable: false, comment: "题目类型：单选题、多选题、判断题、填空题、简答题" })
  question_type!: string;

  @Column({ type: "text", nullable: false, comment: "题目内容" })
  content!: string;

  @Column({ type: "integer", nullable: true, comment: "难度等级：1-5" })
  difficulty: number | null = null;

  @Column({ type: "text", nullable: true, comment: "标准答案" })
  answer: string | null = null;

  @Column({ type: "text", nullable: true, comment: "解析" })
  analysis: string | null = null;

  @Column({ type: "boolean", default: false, comment: "是否有图片" })
  has_image!: boolean;

  @Column({ type: "varchar", length: 255, nullable: true, comment: "图片路径" })
  image_path: string | null = null;

  @Column({ type: "smallint", nullable: true, comment: "适用岗位" })
  fits_position: number | null = null;

  @Column({ type: "integer", nullable: true, comment: "分值" })
  score: number | null = null;

  @Column({ type: "varchar", length: 50, nullable: true, comment: "来源出处" })
  source: string | null = null;

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

  @OneToMany(() => QuestionOption, questionOption => questionOption.questionEntity)
  options!: QuestionOption[];
}