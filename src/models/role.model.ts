import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToMany, JoinTable, OneToMany } from 'typeorm';
import { Tag } from './tag.model';
import { RolePermission } from './role-permission.model';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column({ unique: true })
  code!: string;

  @Column({ nullable: true })
  description: string | '' = '';

  @Column({ default: 1 })
  status!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @Column({ name: 'is_deleted', type: 'tinyint', default: 0 })
  isDeleted!: number;

  @ManyToMany(() => Tag, tag => tag.roles)
  @JoinTable({
    name: 'role_tags',
    joinColumn: { name: 'role_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tag_id', referencedColumnName: 'id' }
  })
  tags!: Tag[];

  @OneToMany(() => RolePermission, rolePermission => rolePermission.role)
  rolePermissions!: RolePermission[];
}