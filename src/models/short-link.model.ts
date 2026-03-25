import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * 短链接实体
 */
@Entity('short_links')
export class ShortLink {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  /**
   * 短码（8位随机字符串）
   */
  @Column({ type: 'varchar', length: 20, unique: true })
  shortCode!: string;

  /**
   * 原始URL（淘宝加购链接）
   */
  @Column({ type: 'text' })
  originalUrl!: string;

  /**
   * 商品信息（JSON格式）
   * 格式: [{materialCode, quantity, itemId, skuId}, ...]
   */
  @Column({ type: 'text', nullable: true})
  items: string | null = null;

  /**
   * 店铺ID
   */
  @Column({ type: 'varchar', length: 50, nullable: true })
  shopId: string | null = null;

  /**
   * 过期时间
   */
  @Column({ type: 'datetime', nullable: true })
  @Index()
  expiresAt: Date | null = null;

  /**
   * 访问次数
   */
  @Column({ type: 'int', default: 0 })
  accessCount!: number;

  /**
   * 最后访问时间
   */
  @Column({ type: 'datetime', nullable: true })
  lastAccessedAt: Date | null = null;

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
