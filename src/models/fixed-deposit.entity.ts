import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('fixed_deposit')
export class FixedDeposit {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  @Column({ type: 'varchar', length: 50, unique: true, comment: '存款编号' })
  depositCode!: string;

  @Column({ type: 'smallint', comment: '存款类型：1-定期，2-活期转定期' })
  depositType!: number;

  @Column({ type: 'date', comment: '起息日期' })
  startDate!: Date;

  @Column({ type: 'varchar', length: 100, comment: '单位名称' })
  companyName!: string;

  @Column({ type: 'decimal', precision: 18, scale: 2, comment: '金额' })
  amount!: number;

  @Column({ type: 'int', comment: '定存期限（月）' })
  depositPeriod!: number;

  @Column({ type: 'date', comment: '到期日' })
  endDate!: Date;

  @Column({ type: 'varchar', length: 500, nullable: true, comment: '备注' })
  remark!: string | null;

  @Column({ type: 'smallint', default: 0, comment: '是否提前释放：0-否，1-是' })
  earlyRelease!: number;

  @Column({ type: 'date', nullable: true, comment: '释放日期' })
  releaseDate!: Date | null;

  @Column({ type: 'int', default: 0, comment: '已计息天数' })
  interestDays!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0, comment: '释放金额' })
  releaseAmount!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0, comment: '剩余金额' })
  remainingAmount!: number;

  @Column({ type: 'smallint', default: 1, comment: '状态：1-待确认，2-已生效，3-删除' })
  status!: number;

  @Column({ type: 'bigint', comment: '创建人' })
  createdBy!: number;

  @CreateDateColumn({ type: 'timestamp', comment: '创建时间' })
  createdAt!: Date;

  @Column({ type: 'varchar', length: 50, comment: '导入批次号' })
  batchNo!: string;

  @Column({ type: 'date', nullable: true, comment: '最近计息日' })
  lastInterestDate!: Date | null;

  // 关系映射
  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdBy' })
  creator!: User;
}
