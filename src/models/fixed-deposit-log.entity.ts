import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { FixedDeposit } from './fixed-deposit.entity';
import { User } from './user.entity';

@Entity('fixed_deposit_log')
export class FixedDepositLog {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  @Column({ type: 'bigint' })
  depositId!: number;

  @Column({ type: 'smallint', comment: '记录类型：1-定期资金释放' })
  logType!: number;

  @Column({ type: 'date', comment: '日志时间' })
  logTime!: Date;

  @Column({ type: 'decimal', precision: 18, scale: 2, comment: '金额' })
  amount!: number;

  @Column({ type: 'varchar', length: 500, nullable: true, comment: '备注' })
  remark!: string | null;

  @Column({ type: 'bigint', comment: '创建人' })
  createdBy!: number;

  @CreateDateColumn({ type: 'timestamp', comment: '创建时间' })
  createdAt!: Date;

  // 关系映射
  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdBy' })
  creator!: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'depositId' })
  deposit!: FixedDeposit;
}
