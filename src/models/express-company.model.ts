import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * 快递公司实体
 */
@Entity('express_company')
export class ExpressCompany {
  @PrimaryGeneratedColumn()
  id!: number;

  /**
   * 快递公司名称
   */
  @Column({ type: 'varchar', length: 50 })
  name!: string;

  /**
   * 快递公司代码（用于API查询）
   */
  @Column({ type: 'varchar', length: 20 })
  @Index()
  code!: string;

  /**
   * 官方网站
   */
  @Column({ type: 'varchar', length: 200, nullable: true })
  website!: string | null;

  /**
   * 客服电话
   */
  @Column({ type: 'varchar', length: 30, nullable: true })
  phone!: string | null;

  /**
   * 是否启用
   */
  @Column({ type: 'tinyint', default: 1 })
  enabled!: number;

  /**
   * 排序
   */
  @Column({ type: 'int', default: 0 })
  sort!: number;

  /**
   * 备注
   */
  @Column({ type: 'text', nullable: true })
  remarks!: string | null;

  /**
   * 创建时间
   */
  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;

  /**
   * 更新时间
   */
  @UpdateDateColumn({ type: 'datetime' })
  updatedAt!: Date;
}
