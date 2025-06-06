import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from './user.model';

@Entity('invite_codes')
export class InviteCode {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 20, unique: true })
  code!: string;

  @Column({ name: 'creator_id' })
  creatorId!: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'creator_id' })
  creator!: User;

  @Column({ default: false })
  used!: boolean;

  @Column({ name: 'used_by', nullable: true })
  usedBy: number | null = null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'used_by' })
  usedByUser: User | null = null;

  @Column({ name: 'used_at', type: 'datetime', nullable: true })
  usedAt: Date | null = null;

  @Column({ name: 'expires_at', type: 'datetime' })
  expiresAt!: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date | null = null;

  /**
   * 检查邀请码是否有效
   * @returns 是否有效
   */
  isValid(): boolean {
    const now = new Date();
    return !this.used && now < this.expiresAt;
  }
}