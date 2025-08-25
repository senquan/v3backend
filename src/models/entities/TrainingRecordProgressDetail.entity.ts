import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Material } from './Material.entity';
import { TrainingRecordProgress } from './TrainingRecordProgress.entity';

@Entity('tr_training_record_progresss_detail')
export class TrainingRecordProgressDetail {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'integer' })
  @Index('idx_training_record_progress_detail_progress_id')
  training_record_progress_id!: number;

  @Column({ type: 'integer' })
  @Index('idx_training_record_progress_detail_material_id')
  material_id!: number;

  @Column({ type: 'integer', default: 0 })
  progress!: number;

  @Column({ type: 'smallint', default: 0 })
  is_locked!: number;

  @CreateDateColumn()
  start_time!: Date;

  @UpdateDateColumn()
  end_time!: Date;

  @UpdateDateColumn()
  update_time!: Date;

  // 关联关系
  @ManyToOne(() => TrainingRecordProgress)
  @JoinColumn({ name: 'training_record_progress_id' })
  training_record_progress!: TrainingRecordProgress;

  @ManyToOne(() => Material)
  @JoinColumn({ name: 'material_id' })
  material!: Material;
}