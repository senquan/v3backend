import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { ExpressCompany } from './express-company.model';

/**
 * 快递跟踪实体
 */
@Entity('express_tracking')
export class ExpressTracking {
  @PrimaryGeneratedColumn()
  id!: number;

  /**
   * 快递公司ID
   */
  @Column({ name: 'express_company_id', type: 'int', nullable: true })
  expressCompanyId!: number | null;

  /**
   * 快递公司名称(冗余字段，用于查询，可关键词匹配)
   */
  @Column({ type: 'varchar', length: 50 })
  expressCompanyName!: string;

  /**
   * 快递单号
   */
  @Column({ type: 'varchar', length: 50 })
  @Index()
  trackingNumber!: string;

  /**
   * 请求类型
   * 1 interception: 拦截请求
   * 2 reject: 拒收
   * 3 no_receive: 未收到
   * 4 damage: 破损
   * 5 lost: 丢件
   * 6 addr_issue: 地址异常
   */
  @Column({ type: 'smallint', default: 0 })
  requestType!: number;

  /**
   * 请求原因
   */
  @Column({ type: 'text', nullable: true })
  requestReason!: string | null;

  /**
   * 状态
   * 0 pending: 待处理
   * 1 in_transit: 拦截中
   * 2 returned: 已退回
   * 3 signed: 已签收
   * 4 confirmed: 已确认
   * 5 timeout: 超时待核实
   * 6 warehoused: 已入库
   * 7 claimed: 理赔中
   * 8 closed: 已完结
   */
  @Column({ type: 'smallint', default: 0 })
  @Index()
  status!: number;

  /**
   * 商品回库状态
   * 0: 完好，不影响二次销售
   * 1：有瑕疵
   * 2：破损
   * 3：遗失
   */
  @Column({ type: 'smallint', default: 0 })
  returnStatus!: number;

  /**
   * 退回时间
   */
  @Column({ type: 'datetime', nullable: true })
  returnedAt!: Date | null;

  /**
   * 签收时间
   */
  @Column({ type: 'datetime', nullable: true })
  signedAt!: Date | null;

  /**
   * 仓库签收入库时间
   */
  @Column({ type: 'datetime', nullable: true })
  warehouseReceivedAt!: Date | null;

  /**
   * 理赔状态
   * none: 无需理赔
   * applied: 已申请
   * approved: 已通过
   * rejected: 已拒绝
   */
  @Column({ type: 'varchar', length: 20, default: 'none' })
  claimStatus!: string;

  /**
   * 理赔金额
   */
  @Column({ type: 'int', default: 0 })
  claimAmount!: number;

  /**
   * 备注
   */
  @Column({ type: 'text', nullable: true })
  remarks!: string | null;

  /**
   * 操作人
   */
  @Column({ type: 'varchar', length: 50, nullable: true })
  operator!: string | null;

  /**
   * 微信消息ID
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  wechatMsgId!: string | null;

  /**
   * 关联订单ID
   */
  @Column({ type: 'varchar', length: 50, nullable: true })
  @Index()
  orderId!: string | null;

  /**
   * 订单金额
   */
  @Column({ type: 'int', default: 0 })
  orderAmount!: number

  /**
   * 关联店铺
   */
  @Column({ type: 'varchar', length: 50, nullable: true })
  storeName: string | null = null;

  /**
   * 访问次数
   */
  @Column({ type: 'int', default: 0 })
  accessCount!: number;

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

  /**
   * 最后追踪时间
   */
  @Column({ type: 'datetime', nullable: true })
  lastTrackingAt!: Date | null;

  /**
   * 关联快递公司
   */
  @ManyToOne(() => ExpressCompany, { nullable: true })
  @JoinColumn({ name: 'express_company_id' })
  expressCompany: ExpressCompany | null = null;
}
