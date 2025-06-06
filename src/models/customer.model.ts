import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Order } from './order.model';

export enum CustomerType {
  INDIVIDUAL = 1,  // 个人客户
  COMPANY = 2,     // 企业客户
  DISTRIBUTOR = 3, // 经销商
  PARTNER = 4      // 合作伙伴
}

export enum CustomerLevel {
  REGULAR = 1,     // 普通客户
  SILVER = 2,      // 银牌客户
  GOLD = 3,        // 金牌客户
  PLATINUM = 4,    // 白金客户
  VIP = 5          // VIP客户
}

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 100 })
  name!: string;

  @Column({ type: 'int', default: CustomerType.INDIVIDUAL, comment: '客户类型' })
  type!: CustomerType;

  @Column({ type: 'varchar', length: 50, nullable: true })
  code: string | null = null;

  @Column({ type: 'varchar', length: 20, nullable: true, comment: '联系电话' })
  phone: string | null = null;

  @Column({ type: 'varchar', length: 100, nullable: true, comment: '电子邮箱' })
  email: string | null = null;

  @Column({ type: 'varchar', length: 200, nullable: true, comment: '联系地址' })
  address: string | null = null;

  @Column({ type: 'int', default: 0, name: 'city_id', comment: '所在城市' })
  cityId: number = 0;

  @Column({ type: 'int', default: 0, name: 'province_id', comment: '所在省份/州' })
  provinceId: number = 0;

  @Column({ type: 'int', default: 0, name: 'district_id', comment: '所在地区/县' })
  districtId: number = 0;

  @Column({ type: 'varchar', name: 'postal_code', length: 20, nullable: true, comment: '邮政编码' })
  postalCode: string | null = null;

  @Column({ type: 'varchar', length: 50, nullable: true, comment: '国家' })
  country: string | null = null;

  @Column({ type: 'varchar', length: 50, nullable: true, comment: '联系人' })
  contactPerson: string | null = null;

  @Column({ type: 'varchar', length: 20, nullable: true, comment: '联系人电话' })
  contactPhone: string | null = null;

  @Column({ type: 'varchar', length: 100, nullable: true, comment: '联系人职位' })
  contactPosition: string | null = null;

  @Column({ type: 'int', default: CustomerLevel.REGULAR, comment: '客户等级' })
  level!: CustomerLevel;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, comment: '累计消费金额' })
  totalSpent!: number;

  @Column({ type: 'int', default: 0, comment: '订单数量' })
  orderCount!: number;

  @Column({ type: 'varchar', length: 100, nullable: true, comment: '公司名称（企业客户）' })
  companyName: string | null = null;

  @Column({ type: 'varchar', length: 100, nullable: true, comment: '税号（企业客户）' })
  taxNumber: string | null = null;

  @Column({ type: 'text', nullable: true, comment: '备注' })
  remark: string | null = null;

  @Column({ type: 'int', name: 'sales_rep_id', nullable: true, comment: '销售代表ID' })
  salesRepId: number | null = null;

  @Column({ type: 'tinyint', default: 1, comment: '是否启用' })
  isActive!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @Column({ name: 'is_deleted', type: 'tinyint', default: 0 })
  isDeleted!: number;

  @OneToMany(() => Order, order => order.customer)
  orders!: Order[];
}