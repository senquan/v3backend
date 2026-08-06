import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { QuotationTemplate } from './quotation-template.model';

@Entity('platform_quotation_template_associations')
export class PlatformQuotationTemplateAssociation {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'platform_id', type: 'int', default: 0, comment: '平台ID' })
  platformId!: number;

  @ManyToOne(() => QuotationTemplate)
  @JoinColumn({ name: 'template_id' })
  template!: QuotationTemplate;

  @Column({ name: 'template_id', type: 'int', comment: '模板ID' })
  templateId!: number;

  @Column({ type: 'int', default: 1, comment: '报价单类型，1=普通 2=工程 3=新版 4=补货 5=退货' })
  type!: number;

  @Column({ name: 'is_deleted', type: 'tinyint', default: 0, comment: '是否删除' })
  isDeleted!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
