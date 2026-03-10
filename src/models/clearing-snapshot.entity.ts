import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
import { User } from './user.entity';

@Entity('clearing_snapshot')
export class ClearingSnapshot {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  @Column({ type: 'varchar', length: 100, comment: '快照名称' })
  snapshotName!: string;

  @Column({ type: 'timestamp', comment: '截至日期' })
  cutoffDate!: Date;

  @Column({ type: 'varchar', length: 255, nullable: true, comment: '备注' })
  remark!: string | null;

  @Column({ type: 'bigint', comment: '创建人ID' })
  createdById!: number;

  @CreateDateColumn({ type: 'timestamp', comment: '创建时间' })
  createdAt!: Date;

  @ManyToOne(() => User)
  creator!: User;
}
