import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('interest_rate')
export class InterestRate {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  @Column({ type: 'smallint', comment: '利率类型：由系统字典 group=3 定义' })
  rateType!: number;

  @Column({ type: 'varchar', length: 50, comment: '利率编号' })
  rateCode!: string;

  @Column({ type: 'decimal', precision: 10, scale: 4, comment: '利率值(%)' })
  rateValue!: number;

  @Column({ type: 'date', comment: '生效日期' })
  effectiveDate!: Date;

  @Column({ type: 'date', nullable: true, comment: '失效日期' })
  expiryDate!: Date | null;

  @Column({ type: 'smallint', default: 1, comment: '状态：1-生效，2-失效' })
  status!: number;

  @Column({ type: 'varchar', length: 10, default: 'CNY', comment: '币种' })
  currency!: string;

  @Column({ type: 'int', nullable: true, comment: '期限(月)' })
  term!: number | null;

  @Column({ type: 'varchar', length: 500, nullable: true, comment: '备注' })
  remark!: string | null;

  @Column({ type: 'bigint', comment: '创建人' })
  createdBy!: number;

  @CreateDateColumn({ type: 'timestamp', comment: '创建时间' })
  createdAt!: Date;

  @Column({ type: 'bigint', comment: '修改人' })
  updatedBy!: number;

  @UpdateDateColumn({ type: 'timestamp', comment: '修改时间' })
  updatedAt!: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdBy' })
  creator!: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'updatedBy' })
  updater!: User;
}
