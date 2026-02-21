import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, UpdateDateColumn, JoinColumn } from 'typeorm';
import { CompanyInfo } from './company-info.entity';
import { User } from './user.entity';

@Entity('profit_payment')
export class ProfitPayment {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  @Column({ type: 'bigint', comment: '单位ID' })
  companyId!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0.00, comment: '第一次应缴利润' })
  dueProfit1!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0.00, comment: '第二次应缴利润' })
  dueProfit2!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0.00, comment: '实缴金额' })
  actualAmount!: number;

  @Column({ type: 'date', nullable: true, comment: '最后缴纳日期' })
  lastPaymentDate: Date | null = null;

  @Column({ type: 'int', comment: '业务年份' })
  businessYear!: number;

  @Column({ type: 'smallint', default: 1, comment: '状态：1-待确认，2-已生效，3-已删除' })
  status!: number;

  @Column({ type: 'varchar', length: 50, nullable: true, comment: '导入批次号' })
  batchNo!: string | null;

  @Column({ type: 'bigint', comment: '创建人' })
  createdBy!: number;

  @Column({ 
    type: 'timestamp', 
    default: () => 'CURRENT_TIMESTAMP',
    comment: '创建时间' 
  })
  createdAt!: Date;

   @Column({ type: 'bigint', comment: '最后修改人' })
  updatedBy!: number;

  @UpdateDateColumn({ type: 'timestamp', comment: '最后修改时间' })
  updatedAt!: Date;

  // 关系映射
  @ManyToOne(() => CompanyInfo)
  company: CompanyInfo | null = null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdBy' })
  creator!: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'updatedBy' })
  updater!: User;
}