import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

@Entity("cs_conversations")
export class CsConversation {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "session_id", type: "varchar", length: 64, comment: "会话ID，同一次对话共享" })
  sessionId!: string;

  @Column({ name: "customer_id", type: "int", nullable: true, comment: "关联客户ID" })
  customerId: number | null = null;

  @Column({ name: "customer_name", type: "varchar", length: 100, nullable: true, comment: "客户名称（冗余）" })
  customerName: string | null = null;

  @Column({ type: "varchar", length: 20, comment: "消息角色: user / assistant" })
  role!: string;

  @Column({ type: "text", comment: "消息内容" })
  content!: string;

  @Column({ name: "knowledge_base_id", type: "int", nullable: true, comment: "使用的知识库ID" })
  knowledgeBaseId: number | null = null;

  @Column({ name: "related_order_ids", type: "varchar", length: 255, nullable: true, comment: "关联的订单ID列表，逗号分隔" })
  relatedOrderIds: string | null = null;

  @Column({ name: "rag_sources", type: "json", nullable: true, comment: "RAG 引用来源 JSON" })
  ragSources: any = null;

  @Column({ name: "latency_ms", type: "int", nullable: true, comment: "AI 响应延迟（毫秒）" })
  latencyMs: number | null = null;

  @CreateDateColumn({ name: "created_at", type: "timestamp", comment: "创建时间" })
  createdAt!: Date;
}
