import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { AdvanceExpenseDetail } from './advance-expense-detail.entity';
import { CompanyInfo } from './company-info.entity';
import { User } from './user.entity';

@Entity('advance_expense')
export class AdvanceExpense {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  @Column({ type: 'varchar', length: 50, unique: true, comment: '垫付编号' })
  advanceCode!: string;

  @Column({ type: 'bigint', comment: '单位ID' })
  companyId!: number;

  @Column({ type: 'smallint', comment: '费用类型：1-利息，2-其他' })
  expenseType!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0, comment: '金额' })
  amount!: number;

  @Column({ type: 'varchar', length: 500, nullable: true, comment: '费用说明' })
  remark!: string | null;

  @Column({ type: 'int', comment: '业务年份' })
  businessYear!: number;

  @Column({ type: 'smallint', default: 1, comment: '状态：1-待确认，2-已生效，3-已删除' })
  status!: number;

  @Column({ type: 'varchar', length: 50, nullable: true, comment: '导入批次号' })
  batchNo!: string | null;

  @Column({ type: 'bigint', comment: '创建人' })
  createdBy!: number;

  @CreateDateColumn({ type: 'timestamp', comment: '创建时间' })
  createdAt!: Date;

  @Column({ type: 'bigint', comment: '最后修改人' })
  updatedBy!: number;

  @UpdateDateColumn({ type: 'timestamp', comment: '最后修改时间' })
  updatedAt!: Date;

  // 关系映射
  @ManyToOne(() => CompanyInfo)
  @JoinColumn({ name: 'companyId' })
  company: CompanyInfo | null = null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdBy' })
  creator!: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'updatedBy' })
  updater!: User;

  @OneToMany(() => AdvanceExpenseDetail, detail => detail.advanceExpense)
  details!: AdvanceExpenseDetail[];
}
