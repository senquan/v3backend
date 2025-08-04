import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import { User } from './User.entity';
import { TrainingPlan } from './TrainingPlan.entity';
import { TrainingRecordParticipant } from './TrainingRecordParticipant.entity';
import { TrainingRecordCourseware } from './TrainingRecordCourseware.entity';
import { TrainingRecordContent } from './TrainingRecordContent.entity';

@Entity('tr_training_records')
export class TrainingRecord {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'integer', nullable: true })
  @Index('idx_training_record_plan_id')
  training_plan_id: number | null = null;

  @Column({ type: 'timestamp', nullable: true })
  actual_time: Date | null = null;

  @Column({ type: 'integer', default: 0 })
  actual_participants!: number;

  @Column({ type: 'integer', default: 0 })
  qualified_participants!: number;

  @Column({ type: 'text', nullable: true })
  content_notes: string | null = null;

  @Column({ type: 'smallint', default: 0 })
  content_type!: number;

  @Column({ type: 'smallint', default: 0 })
  status!: number;

  @Column({ type: 'smallint', default: 0 })
  exam_status!: number;

  @Column({ type: 'text', nullable: true })
  remarks: string | null = null;

  @Column({ type: 'integer', nullable: true })
  creator: number | null = null;

  @CreateDateColumn()
  create_time!: Date;

  @Column({ type: 'integer', nullable: true })
  updater: number | null = null;

  @UpdateDateColumn()
  update_time!: Date;

  // 关联关系
  @ManyToOne(() => TrainingPlan)
  @JoinColumn({ name: 'training_plan_id' })
  training_plan!: TrainingPlan;

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

  @OneToMany(() => TrainingRecordParticipant, participant => participant.training_record)
  participants!: TrainingRecordParticipant[];

  @OneToMany(() => TrainingRecordCourseware, courseware => courseware.training_record)
  coursewares!: TrainingRecordCourseware[];

  @OneToMany(() => TrainingRecordContent, content => content.training_record)
  contents!: TrainingRecordContent[];
}