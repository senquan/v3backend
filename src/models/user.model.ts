import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToMany, JoinTable, OneToOne } from 'typeorm';
import { Role } from './role.model';
import { Staff } from './staff.model';
import * as bcrypt from 'bcryptjs';
import { platform } from 'os';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  username!: string;

  @Column({ select: false })
  password!: string;

  @Column({ nullable: true })
  name: string | '' = '';

  @Column({ nullable: true })
  email: string | '' = '';

  @Column({ nullable: true })
  phone: string | '' = '';

  @Column({ nullable: true })
  avatar: string | '' = '';

  @Column({ default: 1 })
  status!: number;

  @Column('timestamp', { nullable: true })
  last_login_time: Date | null = null;

  @Column({ nullable: true })
  last_login_ip: string | '' = '';

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @ManyToMany(() => Role)
  @JoinTable({
    name: 'user_roles',
    joinColumn: { name: 'user_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'role_id', referencedColumnName: 'id' }
  })
  roles: Role[] | null = null;

  @OneToOne(() => Staff, staff => staff.user)
  staff: Staff | null = null;

  // 验证密码
  async validatePassword(password: string, dbPassword: string): Promise<boolean> {
    return bcrypt.compare(password, dbPassword);
  }

  // 设置密码（自动加密）
  async setPassword(password: string): Promise<void> {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(password, salt);
  }

  // 获取角色代码列表
  getRoleCodes(): string[] {
    return this.roles ? this.roles.map(role => role.code) : [];
  }

  // 获取角色平台列表
  getRolePlatforms(): number[] {
    const platforms = this.roles? this.roles.map(role => role.platforms) : [];
    const platformSet = new Set<number>;
    platforms.forEach(platform => {
      platform.forEach(p => {
        platformSet.add(p.platformId);
      })
    })
    return platforms.length > 0? Array.from(platformSet) : [];
  }
}