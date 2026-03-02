import { Repository, Between, Like } from 'typeorm';
import { OperationLog } from '../models/operation-log.entity';
import { AppDataSource } from '../config/database';
import { CreateOperationLogDto, UpdateOperationLogDto, OperationLogQueryDto } from '../dtos/operation-log.dto';

export class OperationLogService {
  private readonly operationLogRepository: Repository<OperationLog>;
  
  constructor() {
    this.operationLogRepository = AppDataSource.getRepository(OperationLog);
  }

  async findAll(query: OperationLogQueryDto) {
    const { page = 1, size = 10, keyword, operationModule, operationType, status, dateRange } = query;
    const skip = (page - 1) * size;
    
    let whereConditions: any = {};
    
    if (keyword) {
      whereConditions.userName = Like(`%${keyword}%`);
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
      relations: ['user', 'creator', 'updater']
    });

    return {
      records,
      total,
      page: parseInt(page as any),
      size: parseInt(size as any)
    };
  }

  async findOne(id: number) {
    return await this.operationLogRepository.findOne({
      where: { id },
      relations: ['user', 'creator', 'updater']
    });
  }

  async create(createOperationLogDto: CreateOperationLogDto) {
    const operationLog = this.operationLogRepository.create({
      ...createOperationLogDto,
      operationTime: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    return await this.operationLogRepository.save(operationLog);
  }

  async update(id: number, updateOperationLogDto: UpdateOperationLogDto) {
    await this.operationLogRepository.update(id, {
      ...updateOperationLogDto,
      updatedAt: new Date()
    });
    return await this.findOne(id);
  }

  async remove(id: number) {
    return await this.operationLogRepository.delete(id);
  }

  async generateLogCode(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;
    
    // 获取当天最大的日志编号
    const maxLog = await this.operationLogRepository
      .createQueryBuilder('log')
      .where('log.logCode LIKE :prefix', { prefix: `LOG${dateStr}%` })
      .orderBy('log.logCode', 'DESC')
      .getOne();
    
    let sequence = 1;
    if (maxLog) {
      const lastSequence = parseInt(maxLog.logCode.slice(-4));
      sequence = lastSequence + 1;
    }
    
    return `LOG${dateStr}${String(sequence).padStart(4, '0')}`;
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