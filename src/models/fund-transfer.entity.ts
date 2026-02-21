import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('fund_transfer')
export class FundTransfer {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  @Column({ type: 'varchar', length: 50, comment: '转账编号' })
  transferCode!: string;

  @Column({ type: 'varchar', length: 100, comment: '单位名称' })
  companyName!: string;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0, comment: '转账金额' })
  transferAmount!: number;

  @Column({ type: 'smallint', comment: '转账类型：1-上划，2-下拨' })
  transferType!: number;

  @Column({ type: 'date', comment: '转账日期' })
  transferDate!: Date;

  @Column({ type: 'smallint', default: 1, comment: '转账状态：1-待处理，2-处理中，3-已完成，4-已取消' })
  transferStatus!: number;

  @Column({ type: 'varchar', length: 50, nullable: true, comment: '银行账户' })
  bankAccount!: string | null;

  @Column({ type: 'smallint', default: 0, comment: '是否贷款：0-否，1-是' })
  isLoan!: number;

  @Column({ type: 'date', nullable: true, comment: '贷款限期' })
  dueDate!: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true, comment: '备注' })
  remark!: string | null;

  @Column({ type: 'bigint', comment: '创建人' })
  createdBy!: number;

  @CreateDateColumn({ type: 'timestamp', comment: '创建时间' })
  createdAt!: Date;

  @Column({ type: 'bigint', comment: '最后修改人' })
  updatedBy!: number;

  @UpdateDateColumn({ type: 'timestamp', comment: '最后修改时间' })
  updatedAt!: Date;

  @Column({ type: 'varchar', length: 50, nullable: true, comment: '导入批次号' })
  batchNo!: string | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdBy' })
  creator!: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'updatedBy' })
  updater!: User;
}
