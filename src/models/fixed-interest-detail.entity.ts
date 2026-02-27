import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
import { CompanyInfo } from './company-info.entity';

@Entity('daily_fixed_interest_detail')
export class DailyFixedInterestDetail {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  @Column({ type: 'varchar', length: 50, comment: '存款编号' })
  depositCode!: string;

  @Column({ type: 'bigint', comment: '单位ID' })
  companyId!: number;

  @Column({ type: 'date', comment: '计息时间' })
  interestDate!: Date;

  @Column({ type: 'decimal', precision: 18, scale: 2, comment: '定期存(贷)款余额' })
  currentBalance!: number;

  @Column({ type: 'decimal', precision: 10, scale: 4, comment: '利率' })
  currentRate!: number;

  @Column({ type: 'int', comment: '存期(月)' })
  depositPeriod!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, comment: '利息金额' })
  interestAmount!: number;

  @Column({ type: 'smallint', default: 0, comment: '是否预估: 0-否, 1-是' })
  isEstimate!: number;

  @CreateDateColumn({ type: 'timestamp', comment: '创建时间' })
  createdAt!: Date;

  @ManyToOne(() => CompanyInfo)
  company: CompanyInfo | null = null;
}
