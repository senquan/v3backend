import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, ManyToMany, JoinTable } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { CompanyInfo } from './company-info.entity';
import { Role } from './role.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 50, unique: true, comment: '用户名' })
  username!: string;

  @Column({ type: 'varchar', length: 255, comment: '密码' })
  password!: string;

  @Column({ type: 'varchar', length: 100, comment: '姓名' })
  name: string | '' = '';

  @Column({ type: 'varchar', length: 100, comment: '邮箱' })
  email: string | '' = '';

  @Column({ type: 'varchar', length: 100, comment: '电话' })
  phone: string | '' = '';

  @Column({ nullable: true })
  avatar: string | '' = '';

  @Column({ type: 'bigint', nullable: true, comment: '所属单位ID' })
  companyId: number | null = null;

  @Column({ type: 'smallint', default: 1, comment: '状态：1-启用，0-禁用' })
  status!: number;

  @Column({ type: 'integer', default: 0 })
  failedAttempts!: number;

  @Column({ type: 'text', nullable: true })
  notes: string | null = null;

  @Column({ 
    type: 'timestamp',
    nullable: true,
    default: () => 'CURRENT_TIMESTAMP',
    comment: '最后登陆时间' 
  })
  lastLoginAt: Date | null = null;

  @Column({ type: 'varchar', length: 100, comment: '最后登陆IP' })
  lastLoginIp: string | '' = '';
  
  @Column({ 
    type: 'timestamp', 
    default: () => 'CURRENT_TIMESTAMP',
    comment: '创建时间' 
  })
  createdAt!: Date;

  @Column({ 
    type: 'timestamp', 
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
    comment: '更新时间' 
  })
  updatedAt!: Date;

  // 关系映射
  @ManyToOne(() => CompanyInfo)
  company: CompanyInfo | null = null;

  @ManyToMany(() => Role)
  @JoinTable({
    name: 'user_roles',
    joinColumn: {
      name: 'user_id',
      referencedColumnName: 'id',
    },
    inverseJoinColumn: {
      name: 'role_id',
      referencedColumnName: 'id',
    },
  })
  roles: Role[] | null = null;

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
}