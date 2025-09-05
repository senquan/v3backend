import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { TrainingRecordParticipant } from './TrainingRecordParticipant.entity';
import { Courseware } from './Courseware.entity';

@Entity('tr_training_record_progresss')
export class TrainingRecordProgress {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'integer' })
  @Index('idx_training_record_progress_participant_id')
  training_record_participant_id!: number;

  @Column({ type: 'integer' })
  @Index('idx_training_record_progress_courseware_id')
  courseware_id!: number;

  @Column({ type: 'integer', default: 0 })
  progress!: number;

  @Column({ type: 'smallint', default: 0 })
  is_locked!: number;

  @Column({ type: 'integer', default: 0 })
  chapter_count!: number;

  @CreateDateColumn()
  start_time!: Date;

  @UpdateDateColumn()
  end_time!: Date;

  @UpdateDateColumn()
  update_time!: Date;

  // 关联关系
  @ManyToOne(() => TrainingRecordParticipant)
  @JoinColumn({ name: 'training_record_participant_id' })
  training_record_participant!: TrainingRecordParticipant;

  @ManyToOne(() => Courseware)
  @JoinColumn({ name: 'courseware_id' })
  courseware!: Courseware;
}