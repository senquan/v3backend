import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Courseware } from './Courseware.entity';
import { Material } from './Material.entity';

@Entity('tr_courseware_materials')
export class CoursewareMaterial {
  @PrimaryGeneratedColumn()
  _id!: number;

  @Column({ type: 'integer', nullable: false })
  @Index('idx_courseware_materials_courseware_id')
  courseware_id!: number;

  @Column({ type: 'integer', nullable: false })
  @Index('idx_courseware_materials_material_id')
  material_id!: number;

  @Column({ type: 'integer', default: 0 })
  sort!: number;

  // 关联关系
  @ManyToOne(() => Courseware)
  @JoinColumn({ name: 'courseware_id' })
  courseware!: Courseware;

  @ManyToOne(() => Material)
  @JoinColumn({ name: 'material_id' })
  material!: Material;
}