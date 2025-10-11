import { Entity, PrimaryColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Role } from './Role.entity';
import { TrainingUser } from './TrainingUser.entity';

@Entity('user_roles')
export class UserRole {
  @PrimaryColumn({ name: 'user_id' })
  @Index()
  userId!: number;

  @PrimaryColumn({ name: 'role_id' })
  @Index()
  roleId!: number;

  @ManyToOne(() => TrainingUser)
  @JoinColumn({ name: 'user_id' })
  user!: TrainingUser;

  @ManyToOne(() => Role)
  @JoinColumn({ name: 'role_id' })
  role!: Role;
}
