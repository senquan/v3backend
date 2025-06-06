import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { SpecItem } from './spec-item.model';

@Entity('spec_group')
export class SpecGroup {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 255 })
  name!: string;

  @Column({ name: 'is_required', type: 'tinyint', default: 0 })
  isRequired!: number;

  @Column({ default: 0 })
  sort!: number;

  @OneToMany(() => SpecItem, specItem => specItem.group)
  specItems!: SpecItem[];
}