import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { CompanyInfo } from './company-info.entity';

@Entity('internal_deposit')
export class InternalDeposit {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  @Column({ type: 'bigint', comment: '单位ID' })
  companyId!: number;

  @Column({ type: 'smallint', comment: '存款类型：1-活期，2-定期' })
  depositType!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0.00, comment: '余额' })
  balance!: number;

  @Column({ type: 'decimal', precision: 8, scale: 6, nullable: true, comment: '利率' })
  interestRate: number | null = null;

  @Column({ type: 'date', nullable: true, comment: '起始日期' })
  startDate: Date | null = null;

  @Column({ type: 'date', nullable: true, comment: '到期日期' })
  endDate: Date | null = null;

  @Column({ type: 'int', comment: '年份' })
  yearNum!: number;

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