import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from './User.entity';
import { TrainingRecord } from './TrainingRecord.entity';
import { ConstructionWorker } from './ConstructionWorker.entity';

@Entity('tr_training_record_participants')
export class TrainingRecordParticipant {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'integer' })
  @Index('idx_training_record_participant_record_id')
  training_record_id!: number;

  @Column({ type: 'integer', nullable: true })
  @Index('idx_training_record_participant_user_id')
  user_id: number | null = null;

  @Column({ type: 'integer', nullable: true })
  @Index('idx_training_record_participant_worker_id')
  worker_id: number | null = null;

  @Column({ type: 'smallint', default: 0 })
  is_qualified!: number;

  @Column({ type: 'smallint', default: 0 })
  is_trainer!: number;

  // 关联关系
  @ManyToOne(() => TrainingRecord, record => record.participants)
  @JoinColumn({ name: 'training_record_id' })
  training_record!: TrainingRecord;

  @ManyToOne(() => User, {
    createForeignKeyConstraints: false
  })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => ConstructionWorker, {
    createForeignKeyConstraints: false
  })
  @JoinColumn({ name: 'worker_id' })
  worker!: ConstructionWorker;
}