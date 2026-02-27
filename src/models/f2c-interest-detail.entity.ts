import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
import { CompanyInfo } from './company-info.entity';

@Entity('fixed_to_current_interest_detail')
export class FixedToCurrentInterestDetail {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  @Column({ type: 'varchar', length: 50, comment: '存款编号' })
  depositCode!: string;

  @Column({ type: 'bigint', comment: '单位ID' })
  companyId!: number;

  @Column({ type: 'date', comment: '计息起始日期' })
  interestStartDate!: Date;

  @Column({ type: 'date', comment: '计息释放日期' })
  interestReleaseDate!: Date;

  @Column({ type: 'decimal', precision: 18, scale: 2, comment: '释放金额' })
  releaseAmount!: number;

  @Column({ type: 'decimal', precision: 10, scale: 6, comment: '日利率' })
  dailyRate!: number;

  @Column({ type: 'int', comment: '存期(月)' })
  depositPeriod!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, comment: '利息' })
  interestAmount!: number;

  @CreateDateColumn({ type: 'timestamp', comment: '创建时间' })
  createdAt!: Date;

  @ManyToOne(() => CompanyInfo)
  company: CompanyInfo | null = null;
}
