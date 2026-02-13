import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from './user.entity';

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

  @Column({ 
    type: 'timestamp',
    nullable: true,
    default: () => 'CURRENT_TIMESTAMP',
    comment: '使用时间' 
  })
  usedAt: Date | null = null;

  @Column({ 
    type: 'timestamp',
    nullable: true,
    default: () => 'CURRENT_TIMESTAMP',
    comment: '过期时间' 
  })
  expiresAt!: Date;

  @CreateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    comment: '创建时间' 
  })
  createdAt!: Date;

  @UpdateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    comment: '更新时间' 
  })
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