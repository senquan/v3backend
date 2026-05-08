import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Inject } from '@nestjs/common';
import { REDIS_CLIENT } from '../../modules/redis.module';
import Redis from 'ioredis';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { SystemLog, LogLevel, LogCategory, LogChain } from '../../../models/system-log.model';

export interface LogEntry {
  level: LogLevel;
  category: LogCategory;
  message: string;
  context?: Record<string, any>;
  traceId?: string;
  spanId?: string;
  userId?: string;
  userName?: string;
  ip?: string;
  userAgent?: string;
  action?: string;
  resource?: string;
  duration?: number;
  requestId?: string;
  correlationId?: string;
  stackTrace?: string;
  metadata?: Record<string, any>;
}

export interface LogQuery {
  level?: LogLevel;
  category?: LogCategory;
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  traceId?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class LogService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LogService.name);
  private buffer: LogEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private chainId: string = 'default';
  private sequence: number = 0;
  private readonly BUFFER_SIZE = 100;
  private readonly FLUSH_INTERVAL = 2000;
  private readonly REDIS_CHAIN_KEY = 'log:chain:';
  private readonly REDIS_BUFFER_KEY = 'log:buffer:';

  constructor(
    @InjectRepository(SystemLog)
    private logRepository: Repository<SystemLog>,
    @InjectRepository(LogChain)
    private chainRepository: Repository<LogChain>,
    @Inject(REDIS_CLIENT)
    private redisClient: Redis,
  ) {}

  async onModuleInit() {
    await this.loadChainState();
    this.startFlushTimer();
  }

  async onModuleDestroy() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    await this.flush();
  }

  private async loadChainState() {
    try {
      const cached = await this.redisClient.hgetall(`${this.REDIS_CHAIN_KEY}${this.chainId}`);
      if (cached.sequence && cached.latestHash) {
        this.sequence = parseInt(cached.sequence, 10);
      } else {
        const chain = await this.chainRepository.findOne({
          where: { chainId: this.chainId },
          order: { sequence: 'DESC' },
        });
        if (chain) {
          this.sequence = chain.sequence;
          await this.redisClient.hmset(`${this.REDIS_CHAIN_KEY}${this.chainId}`, {
            sequence: this.sequence.toString(),
            latestHash: chain.latestHash,
          });
        }
      }
    } catch (error) {
      this.logger.error('Failed to load chain state:', error);
    }
  }

  private startFlushTimer() {
    this.flushInterval = setInterval(async () => {
      await this.flush();
    }, this.FLUSH_INTERVAL);
  }

  async log(entry: LogEntry): Promise<void> {
    entry.traceId = entry.traceId || uuidv4();
    entry.spanId = entry.spanId || uuidv4().substring(0, 8);
    this.buffer.push(entry);
    if (this.buffer.length >= this.BUFFER_SIZE) {
      await this.flush();
    }
  }

  async trace(message: string, context?: Record<string, any>, category: LogCategory = LogCategory.SYSTEM) {
    return this.log({ level: LogLevel.TRACE, category, message, context });
  }

  async debug(message: string, context?: Record<string, any>, category: LogCategory = LogCategory.SYSTEM) {
    return this.log({ level: LogLevel.DEBUG, category, message, context });
  }

  async info(message: string, context?: Record<string, any>, category: LogCategory = LogCategory.SYSTEM) {
    return this.log({ level: LogLevel.INFO, category, message, context });
  }

  async warn(message: string, context?: Record<string, any>, category: LogCategory = LogCategory.SYSTEM) {
    return this.log({ level: LogLevel.WARN, category, message, context });
  }

  async error(message: string, stackTrace?: string, context?: Record<string, any>, category: LogCategory = LogCategory.SYSTEM) {
    return this.log({ level: LogLevel.ERROR, category, message, stackTrace, context });
  }

  async fatal(message: string, stackTrace?: string, context?: Record<string, any>, category: LogCategory = LogCategory.SYSTEM) {
    return this.log({ level: LogLevel.FATAL, category, message, stackTrace, context });
  }

  private computeHash(data: string, previousHash: string, sequence: number): string {
    const hashContent = `${data}|${previousHash}|${sequence}|${Date.now()}`;
    return crypto.createHash('sha256').update(hashContent).digest('hex');
  }

  private getPreviousHash(): string {
    if (this.sequence === 0) {
      return '0000000000000000000000000000000000000000000000000000000000000000';
    }
    return 'latest';
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const entries = [...this.buffer];
    this.buffer = [];

    try {
      const logs: SystemLog[] = [];
      let currentHash = this.getPreviousHash();

      for (const entry of entries) {
        this.sequence++;
        const logData = JSON.stringify(entry);
        const hash = this.computeHash(logData, currentHash, this.sequence);

        const log = new SystemLog();
        log.level = entry.level;
        log.category = entry.category;
        log.message = entry.message;
        log.context = entry.context ? JSON.stringify(entry.context) : undefined;
        log.traceId = entry.traceId;
        log.spanId = entry.spanId;
        log.userId = entry.userId;
        log.userName = entry.userName;
        log.ip = entry.ip;
        log.userAgent = entry.userAgent;
        log.action = entry.action;
        log.resource = entry.resource;
        log.duration = entry.duration;
        log.requestId = entry.requestId;
        log.correlationId = entry.correlationId;
        log.stackTrace = entry.stackTrace;
        log.metadata = entry.metadata ? JSON.stringify(entry.metadata) : undefined;
        log.previousHash = currentHash === 'latest' ? '' : currentHash;
        log.hash = hash;
        log.sequence = this.sequence;

        logs.push(log);
        currentHash = hash;
      }

      await this.logRepository.save(logs);

      await this.chainRepository.upsert(
        {
          chainId: this.chainId,
          latestHash: currentHash,
          sequence: this.sequence,
          updatedAt: new Date(),
        },
        ['chainId'],
      );

      await this.redisClient.hmset(`${this.REDIS_CHAIN_KEY}${this.chainId}`, {
        sequence: this.sequence.toString(),
        latestHash: currentHash,
      });

      const lastLog = logs[logs.length - 1];
      await this.redisClient.lpush(this.REDIS_BUFFER_KEY, JSON.stringify({
        sequence: lastLog.sequence,
        hash: lastLog.hash,
        timestamp: Date.now(),
      }));
      await this.redisClient.ltrim(this.REDIS_BUFFER_KEY, 0, 999);

    } catch (error) {
      this.logger.error('Failed to flush logs:', error);
      this.buffer.unshift(...entries);
    }
  }

  async queryLogs(query: LogQuery): Promise<{ data: SystemLog[]; total: number }> {
    const page = query.page || 1;
    const pageSize = query.pageSize || 50;

    const whereConditions: any = {};

    if (query.level) {
      whereConditions.level = query.level;
    }
    if (query.category) {
      whereConditions.category = query.category;
    }
    if (query.userId) {
      whereConditions.userId = query.userId;
    }
    if (query.traceId) {
      whereConditions.traceId = query.traceId;
    }
    if (query.startDate && query.endDate) {
      whereConditions.createdAt = Between(query.startDate, query.endDate);
    } else if (query.startDate) {
      whereConditions.createdAt = MoreThanOrEqual(query.startDate);
    } else if (query.endDate) {
      whereConditions.createdAt = LessThanOrEqual(query.endDate);
    }

    const [data, total] = await this.logRepository.findAndCount({
      where: whereConditions,
      order: { createdAt: 'DESC', sequence: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return { data, total };
  }

  async verifyIntegrity(startSequence?: number, endSequence?: number): Promise<{
    valid: boolean;
    brokenLogs: string[];
    checkedCount: number;
  }> {
    const where: any = {};
    if (startSequence && endSequence) {
      where.sequence = Between(startSequence, endSequence);
    } else if (startSequence) {
      where.sequence = MoreThanOrEqual(startSequence);
    } else if (endSequence) {
      where.sequence = LessThanOrEqual(endSequence);
    }

    const logs = await this.logRepository.find({
      where,
      order: { sequence: 'ASC' },
    });

    const brokenLogs: string[] = [];

    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];

      if (i > 0) {
        const previousLog = logs[i - 1];
        if (log.sequence !== previousLog.sequence + 1) {
          brokenLogs.push(`Sequence gap at ${log.sequence}: expected ${previousLog.sequence + 1}, got ${log.sequence}`);
        }
        if (log.previousHash !== previousLog.hash) {
          brokenLogs.push(`Hash chain broken at sequence ${log.sequence}`);
        }
      }
    }

    return {
      valid: brokenLogs.length === 0,
      brokenLogs,
      checkedCount: logs.length,
    };
  }

  async getStatistics(startDate?: Date, endDate?: Date): Promise<Record<string, any>> {
    const where: any = {};
    if (startDate && endDate) {
      where.createdAt = Between(startDate, endDate);
    }

    const [levelStats, categoryStats, total] = await Promise.all([
      this.logRepository
        .createQueryBuilder('log')
        .select('log.level', 'level')
        .addSelect('COUNT(*)', 'count')
        .where(where)
        .groupBy('log.level')
        .getRawMany(),
      this.logRepository
        .createQueryBuilder('log')
        .select('log.category', 'category')
        .addSelect('COUNT(*)', 'count')
        .where(where)
        .groupBy('log.category')
        .getRawMany(),
      this.logRepository.count({ where }),
    ]);

    return {
      total,
      levelStats: levelStats.reduce((acc, stat) => {
        acc[stat.level] = parseInt(stat.count, 10);
        return acc;
      }, {} as Record<string, number>),
      categoryStats: categoryStats.reduce((acc, stat) => {
        acc[stat.category] = parseInt(stat.count, 10);
        return acc;
      }, {} as Record<string, number>),
    };
  }

  async exportLogs(query: LogQuery): Promise<SystemLog[]> {
    const result = await this.queryLogs({ ...query, page: 1, pageSize: 100000 });
    return result.data;
  }

  async cleanOldLogs(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.logRepository.delete({
      createdAt: LessThanOrEqual(cutoffDate),
      level: LogLevel.INFO,
    });

    return result.affected || 0;
  }
}
