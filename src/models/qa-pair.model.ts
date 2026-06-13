import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { KnowledgeBase } from './knowledge-base.model';

@Entity('qa_pairs')
export class QaPair {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'knowledge_base_id', type: 'int', comment: '所属知识库ID' })
  knowledgeBaseId!: number;

  @ManyToOne(() => KnowledgeBase)
  @JoinColumn({ name: 'knowledge_base_id' })
  knowledgeBase!: KnowledgeBase;

  @Column({ type: 'varchar', length: 500, comment: '问句' })
  question!: string;

  @Column({ type: 'text', comment: '回复' })
  answer!: string;

  @Column({ name: 'hit_count', type: 'int', default: 0, comment: '命中次数' })
  hitCount!: number;

  @Column({ type: 'smallint', default: 1, comment: '状态: 1=启用 0=禁用' })
  status!: number;

  @Column({ name: 'is_deleted', type: 'smallint', default: 0, comment: '软删除' })
  isDeleted!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp', comment: '创建时间' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp', comment: '更新时间' })
  updatedAt!: Date;
}
