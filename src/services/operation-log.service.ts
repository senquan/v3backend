import { Repository, Between, Like } from 'typeorm';
import { OperationLog } from '../models/operation-log.entity';
import { AppDataSource } from '../config/database';
import { CreateOperationLogDto, UpdateOperationLogDto, OperationLogQueryDto } from '../dtos/operation-log.dto';
import { summaryEventEmitter, SummaryEvents } from '../events/summary-events';

export class OperationLogService {
  private readonly operationLogRepository: Repository<OperationLog>;
  private static eventListenersInitialized = false;
  
  constructor() {
    this.operationLogRepository = AppDataSource.getRepository(OperationLog);
    this.initEventListeners();
  }

  private initEventListeners() {
    if (OperationLogService.eventListenersInitialized) {
      return;
    }
    
    summaryEventEmitter.on(SummaryEvents.LOG_OPERATIONS, async (data: any) => {
      try {
        const { type, desc, userId, module } = data;
        console.log('[OperationLogService] 事件收到')
        await this.create({
          userId,
          operationModule: module || 'finance',
          operationType: type,
          operationDesc: desc,
          requestUrl: '',
          requestMethod: '',
          clientIp: '',
          status: 1,
          createdBy: userId,
          updatedBy: userId,
          executionTime: 0
        });
      } catch (error) {
        console.error('[OperationLogService] 写入导入确认日志失败:', error);
      }
    });
    
    OperationLogService.eventListenersInitialized = true;
  }

  async findAll(query: OperationLogQueryDto) {
    const { page = 1, size = 10, keyword, operationModule, operationType, status, dateRange } = query;
    const skip = (page - 1) * size;
    
    let whereConditions: any = {};
    
    if (keyword) {
      whereConditions.operationDesc = Like(`%${keyword}%`);
    }
    
    if (operationModule) {
      whereConditions.operationModule = Like(`%${operationModule}%`);
    }
    
    if (operationType) {
      whereConditions.operationType = operationType;
    }
    
    if (status) {
      whereConditions.status = status;
    }
    
    if (dateRange && dateRange.length === 2) {
      const [startDate, endDate] = dateRange;
      whereConditions.operationTime = Between(
        new Date(startDate),
        new Date(`${endDate} 23:59:59`)
      );
    }

    const [records, total] = await this.operationLogRepository.findAndCount({
      where: whereConditions,
      skip,
      take: size,
      order: { operationTime: 'DESC' },
      relations: ['user']
    });

    const sanitizedRecords = records.map(record => ({
      ...record,
      user: record.user ? { name: record.user.name } : null
    }));

    return {
      records: sanitizedRecords,
      total,
      page: parseInt(page as any),
      size: parseInt(size as any)
    };
  }

  async findOne(id: number) {
    const operationLog = await this.operationLogRepository.findOne({
      where: { id },
      relations: ['user']
    });

    if (operationLog && operationLog.user) {
      return {
        ...operationLog,
        user: { name: operationLog.user.name }
      };
    }

    return operationLog;
  }

  async create(createOperationLogDto: CreateOperationLogDto) {
    const operationLog = this.operationLogRepository.create({
      ...createOperationLogDto,
      operationTime: new Date(),
      createdAt: new Date()
    });
    return await this.operationLogRepository.save(operationLog);
  }

  async remove(id: number) {
    return await this.operationLogRepository.delete(id);
  }

  async batchDelete(ids: number[]) {
    return await this.operationLogRepository.delete(ids);
  }

  async getStatistics(query: any) {
    const { startDate, endDate } = query;
    
    let dateCondition = {};
    if (startDate && endDate) {
      dateCondition = {
        operationTime: Between(
          new Date(startDate),
          new Date(`${endDate} 23:59:59`)
        )
      };
    }

    // 按模块统计
    const moduleStats = await this.operationLogRepository
      .createQueryBuilder('log')
      .select('log.operationModule', 'module')
      .addSelect('COUNT(log.id)', 'count')
      .where(dateCondition)
      .groupBy('log.operationModule')
      .getRawMany();

    // 按操作类型统计
    const typeStats = await this.operationLogRepository
      .createQueryBuilder('log')
      .select('log.operationType', 'type')
      .addSelect('COUNT(log.id)', 'count')
      .where(dateCondition)
      .groupBy('log.operationType')
      .getRawMany();

    // 按状态统计
    const statusStats = await this.operationLogRepository
      .createQueryBuilder('log')
      .select('log.status', 'status')
      .addSelect('COUNT(log.id)', 'count')
      .where(dateCondition)
      .groupBy('log.status')
      .getRawMany();

    return {
      moduleStats,
      typeStats,
      statusStats
    };
  }
}