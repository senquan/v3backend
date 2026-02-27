import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
import { CompanyInfo } from './company-info.entity';

@Entity('daily_current_interest_detail')
export class DailyCurrentInterestDetail {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  @Column({ type: 'bigint', comment: '单位ID' })
  companyId!: number;

  @Column({ type: 'date', comment: '计息日期' })
  interestDate!: Date;

  @Column({ type: 'decimal', precision: 18, scale: 2, comment: '每日活期存款余额' })
  currentBalance!: number;

  @Column({ type: 'decimal', precision: 10, scale: 6, comment: '日利率' })
  dailyRate!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, comment: '当日利息' })
  dailyInterest!: number;

  @CreateDateColumn({ type: 'timestamp', comment: '创建时间' })
  createdAt!: Date;

  @ManyToOne(() => CompanyInfo)
  company: CompanyInfo | null = null;
}
