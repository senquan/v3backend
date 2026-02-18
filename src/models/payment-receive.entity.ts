import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('payment_receive')
export class PaymentReceive {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  @Column({ type: 'smallint', comment: '到款类型：1-银行到款，2-票据到款' })
  receiveType!: number;

  @Column({ type: 'date', comment: '到款日期' })
  receiveDate!: Date;

  @Column({ type: 'varchar', length: 50, nullable: true, comment: 'SAP代码' })
  sapCode!: string | null;

  @Column({ type: 'varchar', length: 100, comment: '单位名称' })
  companyName!: string;

  @Column({ type: 'varchar', length: 100, nullable: true, comment: '客户名称' })
  customerName!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true, comment: '项目名称' })
  projectName!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true, comment: '到款银行' })
  receiveBank!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true, comment: '票据号码' })
  billNo!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true, comment: '票据类型：1-银行承兑汇票，2-商业承兑汇票' })
  billType!: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0, comment: '票据金额' })
  billAmount!: number;

  @Column({ type: 'date', nullable: true, comment: '到期日' })
  dueDate!: Date | null;

  @Column({ type: 'date', nullable: true, comment: '托收日期' })
  collectionDate!: Date | null;

  @Column({ type: 'smallint', default: 0, comment: '是否已到账：0-否，1-是' })
  received!: number;

  @Column({ type: 'date', nullable: true, comment: '贴现日期' })
  discountDate!: Date | null;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0, comment: '贴现到款金额' })
  discountAmount!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0, comment: '贴现手续费' })
  discountFee!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0, comment: '到账金额' })
  accountAmount!: number;

  @Column({ type: 'varchar', length: 50, nullable: true, comment: '账套' })
  accountSet!: string | null;

  @Column({ type: 'smallint', default: 1, comment: '状态：1-待确认，2-已生效，3-已清算，4-删除' })
  status!: number;

  @Column({ type: 'bigint', comment: '创建人' })
  createdBy!: number;

  @CreateDateColumn({ type: 'timestamp', comment: '创建时间' })
  createdAt!: Date;

  @Column({ type: 'bigint', comment: '最后修改人' })
  updatedBy!: number;

  @UpdateDateColumn({ type: 'timestamp', comment: '最后修改时间' })
  updatedAt!: Date;

  @Column({ type: 'varchar', length: 50, comment: '导入批次号' })
  batchNo!: string;

  // 关系映射
  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdBy' })
  creator!: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'updatedBy' })
  updator!: User;
}
