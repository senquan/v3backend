import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { User } from "./user.model";

@Entity("bulletins")
export class Bulletin {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 200, comment: "公告标题" })
  title!: string;

  @Column({ type: "text", comment: "公告内容" })
  content!: string;

  @Column({ type: "smallint", default: 1, comment: "公告类型：1-普通公告，2-紧急公告，3-通知公告" })
  type!: number;

  @Column({ type: "smallint", default: 0, comment: "状态：0-草稿，1-已发布，2-已归档" })
  status!: number;  

  @Column({ type: "int", default: 0, comment: "优先级：0-低，1-中，2-高" })
  priority!: number;

  @Column({ type: "boolean", default: true, comment: "是否置顶" })
  is_pinned!: boolean;

  @Column({ type: "timestamp", nullable: true, comment: "发布时间" })
  published_at: Date | null = null;

  @Column({ type: "timestamp", nullable: true, comment: "过期时间" })
  expired_at: Date | null = null;

  @Column({ type: "int", default: 0, comment: "阅读次数" })
  read_count!: number;

  @Column({ type: "varchar", length: 500, nullable: true, comment: "附件路径" })
  attachment_url: string | null = null;

  @Column({ type: "varchar", length: 100, nullable: true, comment: "附件名称" })
  attachment_name: string | null = null;

  @Column({ type: "text", nullable: true, comment: "备注" })
  remark: string | null = null;

  @Column({ type: "boolean", default: false, comment: "是否删除" })
  is_deleted!: boolean;

  // 创建者
  @Column({ type: "int", comment: "创建者ID" })
  creator_id!: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: "creator_id" })
  creator!: User;

  // 更新者
  @Column({ type: "int", nullable: true, comment: "更新者ID" })
  updater_id!: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'updater_id' })
  updater!: User;

  // 发布者
  @Column({ type: 'integer', nullable: true })
  publisher_id: number | null = null;

  @ManyToOne(() => User)
  @JoinColumn({ name: "publisher_id" })
  publisher: User  | null = null;

  @CreateDateColumn({ type: "timestamp", comment: "创建时间" })
  created_at!: Date;

  @UpdateDateColumn({ type: "timestamp", comment: "更新时间" })
  updated_at!: Date;
}