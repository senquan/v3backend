import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { TrainingRecord } from './TrainingRecord.entity';

@Entity('tr_training_record_contents')
export class TrainingRecordContent {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'integer' })
  @Index('idx_training_record_content_record_id')
  training_record_id!: number;

  @Column({ type: 'integer', nullable: false })
  content_id: number | null = null;

  // 关联关系
  @ManyToOne(() => TrainingRecord, record => record.contents)
  @JoinColumn({ name: 'training_record_id' })
  training_record!: TrainingRecord;
}