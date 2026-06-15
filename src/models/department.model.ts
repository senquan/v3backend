import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('departments')
export class Department {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 100, comment: '部门名称' })
  name!: string;

  @Column({ name: 'parent_id', type: 'int', nullable: true, comment: '上级部门ID，null为顶级' })
  parentId: number | null = null;

  @ManyToOne(() => Department, dept => dept.children, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent: Department | null = null;

  @OneToMany(() => Department, dept => dept.parent)
  children!: Department[];

  @Column({ type: 'int', default: 0, comment: '排序值' })
  sort!: number;

  @Column({ name: 'is_active', type: 'tinyint', default: 1, comment: '是否启用' })
  isActive!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @Column({ name: 'is_deleted', type: 'tinyint', default: 0 })
  isDeleted!: number;
}
