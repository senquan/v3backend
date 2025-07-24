import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Trainer } from './Trainer.entity';
import { Tag } from './Tag.entity';

@Entity('trainers_tag')
export class TrainerTag {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'integer' })
  @Index('idx_trainers_tag_trainer_id')
  trainer_id!: number;

  @Column({ type: 'integer' })
  @Index('idx_trainers_tag_tag_id')
  tag_id!: number;

  @CreateDateColumn()
  created_at!: Date;

  // 关联关系
  @ManyToOne(() => Trainer, trainer => trainer.trainerTags, {
    createForeignKeyConstraints: false
  })
  @JoinColumn({ name: 'trainer_id' })
  trainer!: Trainer;

  @ManyToOne(() => Tag, tag => tag.trainerTags, {
    createForeignKeyConstraints: false
  })
  @JoinColumn({ name: 'tag_id' })
  tag!: Tag;
}