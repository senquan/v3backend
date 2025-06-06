import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany, OneToOne } from 'typeorm';
import { Customer } from './customer.model';
import { User } from './user.model';

export enum StaffStatus {
  ACTIVE = 1,      // 在职
  PROBATION = 2,   // 试用期
  LEAVE = 3,       // 休假
  RESIGNED = 4,    // 离职
  SUSPENDED = 5    // 停职
}

export enum StaffRole {
  ADMIN = 1,           // 管理员
  MANAGER = 2,         // 经理
  SUPERVISOR = 3,      // 主管
  SALES = 4,           // 销售
  CUSTOMER_SERVICE = 5,// 客服
  WAREHOUSE = 6,       // 仓库管理员
  FINANCE = 7,         // 财务
  HR = 8,              // 人力资源
  TECHNICIAN = 9,      // 技术人员
  OTHER = 10           // 其他
}

@Entity('staff')
export class Staff {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 20, nullable: true, comment: '工号' })
  staffNo: string | null = null;

  @Column({ type: 'varchar', length: 20, nullable: true, comment: '联系电话' })
  phone: string | null = null;

  @Column({ type: 'varchar', length: 100, nullable: true, comment: '电子邮箱' })
  email: string | null = null;

  @Column({ type: 'int', default: StaffRole.OTHER, comment: '职位角色' })
  role!: StaffRole;

  @Column({ type: 'varchar', length: 100, nullable: true, comment: '职位名称' })
  position: string | null = null;

  @Column({ type: 'varchar', length: 100, nullable: true, comment: '所属部门' })
  department: string | null = null;

  @Column({ name: 'manager_id', nullable: true, comment: '直属上级ID' })
  managerId: number | null = null;

  @ManyToOne(() => Staff, staff => staff.subordinates)
  @JoinColumn({ name: 'manager_id' })
  manager: Staff | null = null;

  @OneToMany(() => Staff, staff => staff.manager)
  subordinates!: Staff[];

  @Column({ name: 'user_id', nullable: true, comment: '关联用户ID' })
  userId: number | null = null;

  @OneToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User | null = null;

  @Column({ type: 'date', nullable: true, comment: '入职日期' })
  hireDate: Date | null = null;

  @Column({ type: 'date', nullable: true, comment: '离职日期' })
  resignDate: Date | null = null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, comment: '基本工资' })
  baseSalary: number | null = null;

  @Column({ type: 'varchar', length: 200, nullable: true, comment: '住址' })
  address: string | null = null;

  @Column({ type: 'varchar', length: 18, nullable: true, comment: '身份证号' })
  idCard: string | null = null;

  @Column({ type: 'date', nullable: true, comment: '出生日期' })
  birthDate: Date | null = null;

  @Column({ type: 'varchar', length: 10, nullable: true, comment: '性别' })
  gender: string | null = null;

  @Column({ type: 'text', nullable: true, comment: '备注' })
  remark: string | null = null;

  @Column({ type: 'int', default: StaffStatus.PROBATION, comment: '员工状态' })
  status!: StaffStatus;

  @Column({ type: 'varchar', length: 255, nullable: true, comment: '头像URL' })
  avatar: string | null = null;

  @Column({ type: 'varchar', length: 100, nullable: true, comment: '紧急联系人' })
  emergencyContact: string | null = null;

  @Column({ type: 'varchar', length: 20, nullable: true, comment: '紧急联系人电话' })
  emergencyPhone: string | null = null;

  @CreateDateColumn({ name: 'create_at' })
  createAt!: Date;

  @UpdateDateColumn({ name: 'update_at' })
  updateAt!: Date;

  @Column({ name: 'is_deleted', type: 'tinyint', default: 0 })
  isDeleted!: number;

  @OneToMany(() => Customer, customer => customer.salesRepId)
  customers!: Customer[];
}