import { Entity, PrimaryGeneratedColumn, Column, Index, Unique } from 'typeorm';

/**
 * Snapshot detail link table - records which source records contributed to each snapshot
 * This avoids data redundancy while enabling accurate drill-down even when source data changes
 */
@Entity('clearing_snapshot_detail_link')
@Unique(['snapshotId', 'sourceTable', 'sourceId'])
export class SnapshotDetailLink {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  @Column({ type: 'bigint', comment: 'Snapshot ID' })
  @Index('idx_snapshot_detail_link_snapshot_id')
  snapshotId!: number;

  @Column({ type: 'varchar', length: 50, comment: 'Source table name' })
  sourceTable!: string;

  @Column({ type: 'bigint', comment: 'Source record ID' })
  sourceId!: number;

  @Column({ type: 'bigint', comment: 'Company ID' })
  companyId!: number;

  @Column({ type: 'varchar', length: 50, comment: 'Summary field this contributes to' })
  field!: string;
}
