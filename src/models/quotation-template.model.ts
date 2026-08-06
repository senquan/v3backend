import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('quotation_templates')
export class QuotationTemplate {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'template_name', length: 100, default: 'default', comment: '模板名称' })
  templateName!: string;

  @Column({ name: 'template_params', type: 'text', nullable: true, comment: '模板参数 JSON' })
  templateParams!: string | null;

  @Column({ name: 'is_enabled', type: 'tinyint', default: 1, comment: '模板是否启用' })
  isEnabled!: number;

  @Column({ name: 'is_deleted', type: 'tinyint', default: 0, comment: '模板是否删除' })
  isDeleted!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
