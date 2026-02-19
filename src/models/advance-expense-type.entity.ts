import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('advance_expense_type')
export class AdvanceExpenseType {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  @Column({ type: 'varchar', length: 100, comment: '代垫费用类型名称' })
  name!: string;

  @Column({ type: 'varchar', length: 500, nullable: true, comment: '代垫费用类型说明' })
  remark!: string | null;

  @Column({ type: 'smallint', default: 1, comment: '状态：1-待确认，2-已生效，3-已删除' })
  status!: number;

  @Column({ type: 'bigint', comment: '创建人' })
  createdBy!: number;

  @CreateDateColumn({ type: 'timestamp', comment: '创建时间' })
  createdAt!: Date;
}
