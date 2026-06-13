import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity("knowledge_bases")
export class KnowledgeBase {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 64, comment: "知识库名称" })
  name!: string;

  @Column({ type: "varchar", length: 200, default: "", comment: "描述" })
  description!: string;

  @Column({ type: "varchar", length: 10, default: "📦", comment: "图标 emoji" })
  icon!: string;

  @Column({ type: "smallint", default: 1, comment: "状态：1-启用，0-禁用" })
  status!: number;

  @Column({ name: "is_deleted", type: "smallint", default: 0, comment: "软删除：0-正常，1-已删除" })
  isDeleted!: number;

  @CreateDateColumn({ name: "created_at", type: "timestamp", comment: "创建时间" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamp", comment: "更新时间" })
  updatedAt!: Date;
}
