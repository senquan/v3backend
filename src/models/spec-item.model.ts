import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { SpecGroup } from './spec-group.model';

@Entity('spec_item')
export class SpecItem {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'group_id' })
  groupId!: number;

  @ManyToOne(() => SpecGroup)
  @JoinColumn({ name: 'group_id' })
  group!: SpecGroup;

  @Column({ length: 255 })
  value!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  image: string | null = null;

  @Column({ default: 0 })
  sort!: number;
}