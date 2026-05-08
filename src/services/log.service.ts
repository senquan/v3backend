import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { SystemLog, LogLevel, LogCategory, LogChain } from '../models/system-log.model';
import { redisClient } from '../config/redis';
import * as crypto from 'crypto';

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
      const cached = await redisClient.hgetall(`${this.REDIS_CHAIN_KEY}${this.chainId}`);
      if (cached.sequence && cached.latestHash) {
        this.sequence = parseInt(cached.sequence, 10);
      } else {
        const chain = await this.chainRepository.findOne({
          where: { chainId: this.chainId },
          order: { sequence: 'DESC' },
        });
        if (chain) {
          this.sequence = chain.sequence;
          await redisClient.hmset(`${this.REDIS_CHAIN_KEY}${this.chainId}`, {
            sequence: this.sequence.toString(),
            latestHash: chain.latestHash,
          });
        }
      }
    } catch (error) {
      console.error('Failed to load chain state:', error);
    }
  }

  private startFlushTimer() {
    this.flushInterval = setInterval(async () => {
      await this.flush();
    }, this.FLUSH_INTERVAL);
  }

  async log(entry: LogEntry): Promise<void> {
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

      await redisClient.hmset(`${this.REDIS_CHAIN_KEY}${this.chainId}`, {
        sequence: this.sequence.toString(),
        latestHash: currentHash,
      });

      const lastLog = logs[logs.length - 1];
      await redisClient.lpush(this.REDIS_BUFFER_KEY, JSON.stringify({
        sequence: lastLog.sequence,
        hash: lastLog.hash,
        timestamp: Date.now(),
      }));
      await redisClient.ltrim(this.REDIS_BUFFER_KEY, 0, 999);

    } catch (error) {
      console.error('Failed to flush logs:', error);
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
    if (query.keyword) {
      whereConditions.message = MoreThanOrEqual(query.keyword);
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
    let previousHash = '0000000000000000000000000000000000000000000000000000000000000000';
    let previousSequence = 0;

    for (const log of logs) {
      if (log.sequence !== previousSequence + 1 && previousSequence !== 0) {
        brokenLogs.push(`Sequence gap: expected ${previousSequence + 1}, got ${log.sequence}`);
      }

      const expectedPreviousHash = previousSequence === 0
        ? '0000000000000000000000000000000000000000000000000000000000000000'
        : logs[logs.indexOf(log) - 1]?.hash || previousHash;

      if (log.previousHash !== expectedPreviousHash && log.sequence > 1) {
        brokenLogs.push(`Hash chain broken at sequence ${log.sequence}: expected previous hash ${expectedPreviousHash}, got ${log.previousHash}`);
      }

      const logData = JSON.stringify({
        level: log.level,
        category: log.category,
        message: log.message,
        context: log.context,
        traceId: log.traceId,
        spanId: log.spanId,
        userId: log.userId,
        userName: log.userName,
        ip: log.ip,
        userAgent: log.userAgent,
        action: log.resource,
        duration: log.duration,
        requestId: log.requestId,
        correlationId: log.correlationId,
        stackTrace: log.stackTrace,
        metadata: log.metadata,
      });

      const computedHash = this.computeHash(logData, log.previousHash, log.sequence);
      if (computedHash !== log.hash && log.sequence > 1) {
        brokenLogs.push(`Hash mismatch at sequence ${log.sequence}: content may have been tampered`);
      }

      previousHash = log.hash;
      previousSequence = log.sequence;
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

    const [total, levelStats, categoryStats, recentLogs] = await Promise.all([
      this.logRepository.count({ where }),
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
      this.logRepository.find({
        where,
        order: { createdAt: 'DESC' },
        take: 10,
      }),
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
      recentLogs,
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
