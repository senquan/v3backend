import { Entity, PrimaryGeneratedColumn, Column, JoinColumn, ManyToOne } from 'typeorm';
import { AdvanceExpense } from './advance-expense.entity';
import { AdvanceExpenseType } from './advance-expense-type.entity';

@Entity('advance_expense_detail')
export class AdvanceExpenseDetail {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  @Column({ type: 'bigint', comment: '代垫费用编号' })
  expenseId!: number;

  @Column({ type: 'bigint', comment: '代垫费用类型编号' })
  expenseTypeId!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0, comment: '金额' })
  amount!: number;

  // 关联映射
  @ManyToOne(() => AdvanceExpense, advanceExpense => advanceExpense.details)
  @JoinColumn({ name: 'expenseId' })
  advanceExpense!: AdvanceExpense;

  @ManyToOne(() => AdvanceExpenseType)
  @JoinColumn({ name: 'expenseTypeId' })
  expenseType!: AdvanceExpenseType;
}
