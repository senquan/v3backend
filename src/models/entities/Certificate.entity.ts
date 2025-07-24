import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { CertificateTemplate } from './CertificateTemplate.entity';
import { User } from './User.entity';

@Entity('certificates')
export class Certificate {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int', comment: '证书模板ID' })
  template_id!: number;

  @Column({ type: 'int', comment: '学员用户ID' })
  user_id!: number;

  @Column({ type: 'varchar', length: 100, comment: '证书编号' })
  certificate_number!: string;

  @Column({ type: 'varchar', length: 100, comment: '学员姓名' })
  student_name!: string;

  @Column({ type: 'varchar', length: 100, nullable: true, comment: '课程名称' })
  course_name?: string;

  @Column({ type: 'varchar', length: 100, nullable: true, comment: '培训计划名称' })
  plan_name?: string;

  @Column({ type: 'date', nullable: true, comment: '培训开始日期' })
  training_start_date?: Date;

  @Column({ type: 'date', nullable: true, comment: '培训结束日期' })
  training_end_date?: Date;

  @Column({ type: 'date', comment: '证书颁发日期' })
  issue_date!: Date;

  @Column({ type: 'date', nullable: true, comment: '证书有效期至' })
  valid_until?: Date;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, comment: '培训成绩' })
  score?: number;

  @Column({ type: 'varchar', length: 50, nullable: true, comment: '培训等级' })
  grade?: string;

  @Column({ type: 'jsonb', nullable: true, comment: '证书自定义字段数据' })
  custom_fields?: any;

  @Column({ type: 'varchar', length: 255, nullable: true, comment: '证书文件路径' })
  certificate_file?: string;

  @Column({ type: 'smallint', default: 1, comment: '证书状态：1-有效，2-已撤销，3-已过期' })
  status!: number;

  @Column({ type: 'text', nullable: true, comment: '备注' })
  remark?: string;

  @Column({ type: 'int', nullable: true, comment: '颁发人ID' })
  issuer_id?: number;

  @Column({ type: 'varchar', length: 100, nullable: true, comment: '颁发人姓名' })
  issuer_name?: string;

  @Column({ type: 'boolean', default: false, comment: '是否删除' })
  is_deleted!: boolean;

  @CreateDateColumn({ type: 'timestamp', comment: '创建时间' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp', comment: '更新时间' })
  updated_at!: Date;

  // 关联关系
  @ManyToOne(() => CertificateTemplate)
  @JoinColumn({ name: 'template_id' })
  template!: CertificateTemplate;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'issuer_id' })
  issuer!: User;
}