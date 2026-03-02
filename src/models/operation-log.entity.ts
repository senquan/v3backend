import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('operation_log')
export class OperationLog {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  @Column({ type: 'varchar', length: 30, unique: true, comment: '日志编号' })
  logCode!: string;

  @Column({ type: 'bigint', comment: '用户ID' })
  userId!: number;

  @Column({ type: 'varchar', length: 50, comment: '用户名' })
  userName!: string;

  @Column({ type: 'varchar', length: 100, comment: '真实姓名' })
  realName!: string;

  @Column({ type: 'varchar', length: 50, comment: '操作模块' })
  operationModule!: string;

  @Column({ type: 'smallint', comment: '操作类型：1-新增，2-修改，3-删除，4-查询，5-导出，6-登录，7-登出' })
  operationType!: number;

  @Column({ type: 'varchar', length: 200, comment: '操作描述' })
  operationDesc!: string;

  @Column({ type: 'varchar', length: 200, comment: '请求URL' })
  requestUrl!: string;

  @Column({ type: 'varchar', length: 10, comment: '请求方法' })
  requestMethod!: string;

  @Column({ type: 'text', nullable: true, comment: '请求参数' })
  requestParams: string | null = null;

  @Column({ type: 'text', nullable: true, comment: '响应结果' })
  responseResult: string | null = null;

  @Column({ type: 'varchar', length: 50, comment: '客户端IP' })
  clientIp!: string;

  @Column({ type: 'text', nullable: true, comment: '用户代理' })
  userAgent: string | null = null;

  @Column({ 
    type: 'timestamp', 
    default: () => 'CURRENT_TIMESTAMP',
    comment: '操作时间' 
  })
  operationTime!: Date;

  @Column({ type: 'integer', default: 0, comment: '执行时间(ms)' })
  executionTime!: number;

  @Column({ type: 'smallint', default: 1, comment: '状态：1-成功，2-失败' })
  status!: number;

  @Column({ type: 'varchar', length: 200, nullable: true, comment: '备注' })
  remark: string | null = null;

  @Column({ type: 'bigint', comment: '创建人' })
  createdBy!: number;

  @Column({ 
    type: 'timestamp', 
    default: () => 'CURRENT_TIMESTAMP',
    comment: '创建时间' 
  })
  createdAt!: Date;

  @Column({ type: 'bigint', comment: '最后修改人' })
  updatedBy!: number;

  @Column({ 
    type: 'timestamp', 
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
    comment: '最后修改时间' 
  })
  updatedAt!: Date;

  // 关系映射
  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User | null = null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdBy' })
  creator!: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'updatedBy' })
  updater!: User;
}