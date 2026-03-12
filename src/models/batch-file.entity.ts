import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity("batch_file")
export class BatchFile {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 100 })
  url!: string;

  @Column({ type: 'varchar', length: 45, default: "" })
  batchNo!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  remark!: string | null;

  @Column({ type: 'bigint', comment: '创建人' })
  createdBy!: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', comment: '创建时间' })
  createdAt!: Date;
}