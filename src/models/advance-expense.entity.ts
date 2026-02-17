import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { CompanyInfo } from './company-info.entity';

@Entity('advance_expense')
export class AdvanceExpense {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  @Column({ type: 'bigint', comment: '单位ID' })
  companyId!: number;

  @Column({ type: 'smallint', comment: '费用类型' })
  expenseType!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0.00, comment: '金额' })
  amount!: number;

  @Column({ type: 'text', nullable: true, comment: '费用说明' })
  description: string | null = null;

  @Column({ type: 'int', comment: '业务年份' })
  businessYear!: number;

  @Column({ type: 'smallint', default: 1, comment: '状态：1-有效，0-无效' })
  status!: number;

  @Column({ 
    type: 'timestamp', 
    default: () => 'CURRENT_TIMESTAMP',
    comment: '创建时间' 
  })
  createdAt!: Date;

  // 关系映射
  @ManyToOne(() => CompanyInfo)
  company: CompanyInfo | null = null;
}