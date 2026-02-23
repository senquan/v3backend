import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { CompanyInfo } from './company-info.entity';

@Entity('clearing_summary')
export class ClearingSummary {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  @Column({ type: 'bigint', comment: '单位ID' })
  companyId!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0, comment: '内部存款余额' })
  internalDepositBalance!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0, comment: '所得税清算' })
  incomeTaxSettlement!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0, comment: '代垫到期票据款' })
  dueBillAdvance!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0, comment: '代垫费用' })
  expenseAdvance!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0, comment: '代垫职工薪酬' })
  salaryAdvance!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0, comment: '本年上缴利润-第一次应缴' })
  dueProfit1!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0, comment: '本年上缴利润-第二次应缴' })
  dueProfit2!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0, comment: '本年上缴利润-已缴' })
  profitPaid!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0, comment: '代开票据金额' })
  billAmount!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0, comment: '其他' })
  other!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0, comment: '往来余额' })
  contactBalance!: number;

  @Column({ type: 'smallint', default: 0, comment: '排序' })
  sort!: number;

  @Column({ type: 'timestamp', comment: '最后统计时间' })
  lastStatDate!: Date;

  // 关系映射
  @ManyToOne(() => CompanyInfo)
  company: CompanyInfo | null = null;
}
