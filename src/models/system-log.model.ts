import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum LogLevel {
  TRACE = 'trace',
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
}

export enum LogCategory {
  SYSTEM = 'system',
  BUSINESS = 'business',
  SECURITY = 'security',
  API = 'api',
  DATABASE = 'database',
  BOT = 'bot',
  ORDER = 'order',
  EXPRESS = 'express',
  USER = 'user',
  PAYMENT = 'payment',
}

@Entity('system_logs')
@Index(['level'])
@Index(['category'])
@Index(['createdAt'])
@Index(['traceId'])
@Index(['userId'])
export class SystemLog {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ type: 'varchar', length: 32, default: LogLevel.INFO })
  level!: LogLevel;

  @Column({ type: 'varchar', length: 64 })
  category!: LogCategory;

  @Column({ type: 'varchar', length: 500 })
  message!: string;

  @Column({ type: 'text', nullable: true })
  context?: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  traceId?: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  spanId?: string;

  @Column({ type: 'bigint', nullable: true })
  userId?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  userName?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  ip?: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  userAgent?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  action?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  resource?: string;

  @Column({ type: 'int', default: 0 })
  duration?: number;

  @Column({ type: 'varchar', length: 64, nullable: true })
  requestId?: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  correlationId?: string;

  @Column({ type: 'text', nullable: true })
  stackTrace?: string;

  @Column({ type: 'text', nullable: true })
  metadata?: string;

  @Column({ type: 'varchar', length: 64 })
  previousHash!: string;

  @Column({ type: 'varchar', length: 64 })
  hash!: string;

  @Column({ type: 'int', default: 0 })
  sequence!: number;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}

@Entity('log_chains')
export class LogChain {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  chainId!: string;

  @Column({ type: 'varchar', length: 64 })
  latestHash!: string;

  @Column({ type: 'int', default: 0 })
  sequence!: number;

  @Column({ type: 'timestamp' })
  createdAt!: Date;

  @Column({ type: 'timestamp' })
  updatedAt!: Date;
}

@Entity('log_archive')
export class LogArchive {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ type: 'varchar', length: 64 })
  archiveId!: string;

  @Column({ type: 'varchar', length: 10 })
  date!: string;

  @Column({ type: 'int' })
  count!: number;

  @Column({ type: 'varchar', length: 64 })
  startHash!: string;

  @Column({ type: 'varchar', length: 64 })
  endHash!: string;

  @Column({ type: 'varchar', length: 64 })
  checksum!: string;

  @Column({ type: 'timestamp' })
  createdAt!: Date;
}
