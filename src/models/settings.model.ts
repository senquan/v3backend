import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

// 设置类型枚举
export enum SettingType {
  SYSTEM = 1,      // 系统设置
  PAYMENT = 2,     // 支付设置
  EMAIL = 3,       // 邮件设置
  SMS = 4,         // 短信设置
  LOGISTICS = 5,   // 物流设置
  SITE = 6,        // 站点设置
  CUSTOM = 99      // 自定义设置
}

@Entity('settings')
export class Settings {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 100, comment: '设置键名' })
  key!: string;

  @Column({ type: 'text', comment: '设置值，JSON格式' })
  value!: string;

  @Column({ type: 'int', comment: '设置类型', default: SettingType.SYSTEM })
  type!: SettingType;

  @Column({ length: 100, comment: '设置名称' })
  name!: string;

  @Column({ type: 'varchar', length: 255, nullable: true, comment: '设置描述' })
  description!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true, comment: '设置分组' })
  group!: string | null;

  @Column({ type: 'tinyint', default: 0, comment: '是否系统内置（0否，1是）' })
  isSystem!: number;

  @Column({ type: 'tinyint', default: 1, comment: '是否启用（0否，1是）' })
  isEnabled!: number;

  @Column({ type: 'int', default: 0, comment: '排序' })
  sort!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @Column({ name: 'is_deleted', type: 'tinyint', default: 0 })
  isDeleted!: number;
}