import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { CompanyInfo } from './company-info.entity';

@Entity('profit_payment')
export class ProfitPayment {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  @Column({ type: 'bigint', comment: '单位ID' })
  companyId!: number;

  @Column({ type: 'smallint', comment: '缴纳阶段：1-第一次，2-第二次' })
  paymentPhase!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0.00, comment: '应缴金额' })
  plannedAmount!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0.00, comment: '实缴金额' })
  actualAmount!: number;

  @Column({ type: 'date', nullable: true, comment: '缴纳日期' })
  paymentDate: Date | null = null;

  @Column({ type: 'int', comment: '业务年份' })
  businessYear!: number;

  @Column({ type: 'smallint', default: 1, comment: '状态' })
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