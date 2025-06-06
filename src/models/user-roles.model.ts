import { Entity, PrimaryColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Role } from './role.model';

@Entity('user_roles')
export class UserRole {
  @PrimaryColumn({ name: 'user_id' })
  @Index()
  userId!: number;

  @PrimaryColumn({ name: 'role_id' })
  @Index()
  roleId!: number;

  @ManyToOne(() => Role)
  @JoinColumn({ name: 'role_id' })
  role!: Role;
}
