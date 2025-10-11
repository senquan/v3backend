import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { RolePermission } from './RolePermission.entity';

@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 50 })
  name!: string;

  @Column({ length: 50 })
  title!: string;

  @Column({ length: 100, unique: true })
  code!: string;

  @Column({ type: 'smallint' })
  type!: number;

  @Column({ name: 'parent_id', nullable: true })
  parentId: number | null = null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  path: string | null = null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  component: string | null = null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  redirect: string | null = null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  icon: string | null = null;

  @Column({ default: 0 })
  sort!: number;

  @Column({ type: 'smallint', default: 0 })
  hidden!: number;

  @Column({ type: 'smallint', default: 1 })
  status!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => Permission, permission => permission.children)
  @JoinColumn({ name: 'parent_id' })
  parent: Permission | null = null;

  @OneToMany(() => Permission, permission => permission.parent)
  children!: Permission[];

  @OneToMany(() => RolePermission, rolePermission => rolePermission.permission)
  rolePermissions!: RolePermission[];
}