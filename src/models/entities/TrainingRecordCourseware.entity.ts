import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from './User.entity';
import { TrainingRecord } from './TrainingRecord.entity';
import { Courseware } from './Courseware.entity';

@Entity('tr_training_record_coursewares')
export class TrainingRecordCourseware {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'integer' })
  @Index('idx_training_record_courseware_record_id')
  training_record_id!: number;

  @Column({ type: 'integer' })
  @Index('idx_training_record_courseware_courseware_id')
  courseware_id!: number;

  @Column({ type: 'integer', nullable: true })
  creator: number | null = null;

  @CreateDateColumn()
  create_time!: Date;

  @Column({ type: 'integer', nullable: true })
  updater: number | null = null;

  @UpdateDateColumn()
  update_time!: Date;

  // 关联关系
  @ManyToOne(() => TrainingRecord, record => record.coursewares)
  @JoinColumn({ name: 'training_record_id' })
  training_record!: TrainingRecord;

  @ManyToOne(() => Courseware)
  @JoinColumn({ name: 'courseware_id' })
  courseware!: Courseware;

  @ManyToOne(() => User, {
    createForeignKeyConstraints: false
  })
  @JoinColumn({ name: 'creator' })
  creator_info!: User;

  @ManyToOne(() => User, {
    createForeignKeyConstraints: false
  })
  @JoinColumn({ name: 'updater' })
  updater_info!: User;
}