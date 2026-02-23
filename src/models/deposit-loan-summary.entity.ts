import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { CompanyInfo } from './company-info.entity';

@Entity('deposit_loan_summary')
export class DepositLoanSummary {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  @Column({ type: 'bigint', comment: '单位ID' })
  companyId!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0, comment: '内部贷款余额' })
  loanBalance!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0, comment: '内部贷款利息' })
  loanInterest!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0, comment: '活期存款-到款' })
  depositIncoming!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0, comment: '活期存款-上划' })
  depositTransferUp!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0, comment: '活期存款-定期转入' })
  depositFromFixed!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0, comment: '活期存款-上划下拨' })
  depositTransferDown!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0, comment: '活期存款-上划转入定期' })
  depositToFixed!: number;

  @Column({ type: 'jsonb', nullable: true, comment: '定期存款(JSON格式: {term: value})' })
  depositFixed!: Record<string, number> | null;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0, comment: '活期利息' })
  depositCurrentInterest!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0, comment: '定期利息' })
  depositFixedInterest!: number;

  @Column({ type: 'int', default: 0, comment: '排序' })
  sort!: number;

  @Column({ type: 'timestamp', comment: '最后汇总时间' })
  lastStatDate!: Date;

  @ManyToOne(() => CompanyInfo)
  company: CompanyInfo | null = null;
}
