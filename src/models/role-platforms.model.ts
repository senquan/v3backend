import { Entity, PrimaryColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Role } from './role.model';
import { Dict } from './dict.model';

@Entity('role_platforms')
export class RolePlatforms {
  @PrimaryColumn({ name: 'role_id' })
  @Index()
  roleId!: number;

  @PrimaryColumn({ name: 'platform_id' })
  @Index()
  platformId!: number;

  @ManyToOne(() => Role, role => role.platforms)
  @JoinColumn({ name: 'role_id' })
  role!: Role;

  platformInfo?: Dict;
}