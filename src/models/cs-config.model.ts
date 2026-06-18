import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity("cs_config")
export class CsConfig {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "decimal", precision: 3, scale: 1, default: 0.3, comment: "温度参数 0.1-1.0" })
  temperature!: number;

  @Column({ name: "similarity_threshold", type: "decimal", precision: 3, scale: 2, default: 0.45, comment: "向量相似度阈值" })
  similarityThreshold!: number;

  @Column({ name: "max_retrieval_count", type: "int", default: 3, comment: "最大检索条数" })
  maxRetrievalCount!: number;

  @Column({ name: "enable_auto_parse", type: "smallint", default: 1, comment: "导入文档时自动提取问答：1-开启，0-关闭" })
  enableAutoParse!: number;

  @Column({ name: "system_prompt", type: "text", comment: "系统提示词" })
  systemPrompt!: string;

  @CreateDateColumn({ name: "created_at", type: "timestamp", comment: "创建时间" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamp", comment: "更新时间" })
  updatedAt!: Date;
}
