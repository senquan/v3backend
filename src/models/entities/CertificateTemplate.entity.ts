import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('certificate_template')
export class CertificateTemplate {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  name: string | null = null; // 模板名称

  @Column({ type: 'text', nullable: true })
  description: string | null = null; // 模板描述

  @Column({ type: 'varchar', length: 255, nullable: true })
  background_image: string | null = null; // 背景图片

  @Column({ type: 'smallint', nullable: true })
  cer_type: number | null = null; // 证书类型

  @Column({ type: 'jsonb', nullable: true })
  cer_fields: any = null; // 证书字段，排版位置，自定义数据

  @Column({ type: 'varchar', length: 100, nullable: true })
  cer_title: string | null = null; // 证书标题

  @Column({ type: 'varchar', length: 255, nullable: true })
  cer_content: string | null = null; // 证书内容

  @Column({ type: 'varchar', length: 100, nullable: true })
  cer_right_signature_company: string | null = null; // 右侧签名公司

  @Column({ type: 'varchar', length: 100, nullable: true })
  cer_right_signature_datetime: string | null = null; // 右侧签名日期

  @Column({ type: 'varchar', length: 255, nullable: true })
  cer_right_signature_seal: string | null = null; // 右侧签名印章

  @Column({ type: 'varchar', length: 100, nullable: true })
  cer_left_signature_company: string | null = null; // 左侧签名公司

  @Column({ type: 'varchar', length: 100, nullable: true })
  cer_left_signature_datetime: string | null = null; // 左侧签名日期

  @Column({ type: 'varchar', length: 255, nullable: true })
  cer_left_signature_seal: string | null = null; // 左侧签名印章

  @Column({ type: 'boolean', default: false })
  is_deleted!: boolean; // 是否删除

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}