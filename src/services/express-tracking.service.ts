import { AppDataSource } from '../config/database';
import { Like } from 'typeorm';
import { ExpressCompany } from '../models/express-company.model';
import { ExpressTracking } from '../models/express-tracking.model';
import { ExpressStateMachine } from '../state-machines/express.state-machine'
import { logger } from '../utils/logger';

interface CreateInterceptionParams {
  expressCompanyName?: string;
  expressCompanyId?: number;
  trackingNumber: string;
  requestType: number;
  requestReason?: string;
  operator?: string;
  wechatMsgId?: string;
  orderId?: string;
}

interface UpdateStatusParams {
  status: number;
  operator?: string;
  remarks?: string;
  returnedAt?: Date;
  signedAt?: Date;
  warehouseReceivedAt?: Date;
}

/**
 * 快递跟踪服务
 * 负责快递拦截记录的管理和物流查询
 */
export class ExpressTrackingService {
  private repository = AppDataSource.getRepository(ExpressTracking);
  private companyRepository = AppDataSource.getRepository(ExpressCompany);

  /**
   * 创建快递拦截记录
   */
  async createInterception(params: CreateInterceptionParams): Promise<ExpressTracking> {
    const { expressCompanyName, trackingNumber, requestType, requestReason, operator, wechatMsgId, orderId } = params;

    // 检查是否已存在该单号的记录
    const existing = await this.repository.findOne({
      where: { trackingNumber }
    });

    if (existing) {
      throw new Error(`单号 ${trackingNumber} 已存在记录，请勿重复创建`);
    }

    const expressCompany = await this.companyRepository.findOne({ where: { name: Like('%' + expressCompanyName + '%') } });

    // 创建新记录
    const record = this.repository.create({
      trackingNumber,
      requestType,
      requestReason: requestReason || '',
      status: 0,
      operator: operator || '',
      wechatMsgId: wechatMsgId || '',
      orderId: orderId || '',
      accessCount: 0,
      expressCompany
    });

    await this.repository.save(record);
    logger.info(`创建快递跟踪记录成功: ${trackingNumber}, 类型: ${requestType}`);

    return record;
  }

  /**
   * 根据单号查询记录
   */
  async findByTrackingNumber(trackingNumber: string): Promise<ExpressTracking | null> {
    return this.repository.findOne({
      where: { trackingNumber }
    });
  }

  /**
   * 根据ID查询记录
   */
  async findById(id: number): Promise<ExpressTracking | null> {
    return this.repository.findOne({
      where: { id }
    });
  }

  /**
   * 获取记录列表
   */
  async findList(params: {
    page?: number;
    size?: number;
    status?: string;
    requestType?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{ list: ExpressTracking[]; total: number }> {
    const { page = 1, size = 20, status, requestType, startDate, endDate } = params;

    const queryBuilder = this.repository.createQueryBuilder('record');

    if (status) {
      queryBuilder.andWhere('record.status = :status', { status });
    }

    if (requestType) {
      queryBuilder.andWhere('record.requestType = :requestType', { requestType });
    }

    if (startDate) {
      queryBuilder.andWhere('record.createdAt >= :startDate', { startDate });
    }

    if (endDate) {
      queryBuilder.andWhere('record.createdAt <= :endDate', { endDate });
    }

    queryBuilder.orderBy('record.createdAt', 'DESC');
    queryBuilder.skip((page - 1) * size).take(size);

    const [list, total] = await queryBuilder.getManyAndCount();

    return { list, total };
  }

  /**
   * 更新记录状态
   */
  async updateStatus(id: number, params: UpdateStatusParams): Promise<ExpressTracking | null> {
    const { status, operator, remarks, returnedAt, signedAt, warehouseReceivedAt } = params;

    const record = await this.repository.findOne({ where: { id } });

    if (!record) {
      return null;
    }

    record.status = status;
    if (operator) record.operator = operator;
    if (remarks) record.remarks = remarks;
    if (returnedAt) record.returnedAt = returnedAt;
    if (signedAt) record.signedAt = signedAt;
    if (warehouseReceivedAt) record.warehouseReceivedAt = warehouseReceivedAt;

    await this.repository.save(record);
    logger.info(`更新快递跟踪状态: ID=${id}, 状态=${status}`);

    return record;
  }

  /**
   * 根据单号更新状态
   */
  async updateStatusByTrackingNumber(trackingNumber: string, params: UpdateStatusParams): Promise<ExpressTracking | null> {
    const record = await this.repository.findOne({ where: { trackingNumber } });

    if (!record) {
      return null;
    }

    return this.updateStatus(record.id, params);
  }

  /**
   * 入库操作
   */
  async warehouseIn(id: number, operator: string): Promise<ExpressTracking | null> {
    return this.updateStatus(id, {
      status: ExpressStateMachine.States.WAREHOUSED,
      operator,
      warehouseReceivedAt: new Date()
    });
  }

  /**
   * 完结记录
   */
  async closeRecord(id: number, operator: string, remarks?: string): Promise<ExpressTracking | null> {
    return this.updateStatus(id, {
      status: ExpressStateMachine.States.CLOSED,
      operator,
      remarks
    });
  }

  /**
   * 获取待处理的记录
   */
  async getPendingList(): Promise<ExpressTracking[]> {
    return this.repository.find({
      where: [
        { status: ExpressStateMachine.States.PENDING },
        { status: ExpressStateMachine.States.IN_TRANSIT }
      ],
      order: { createdAt: 'ASC' }
    });
  }

  /**
   * 获取需要理赔的记录
   */
  async getClaimList(): Promise<ExpressTracking[]> {
    return this.repository.find({
      where: { status: ExpressStateMachine.States.CLAIMED },
      order: { updatedAt: 'ASC' }
    });
  }

  /**
   * 删除记录
   */
  async deleteRecord(id: number): Promise<boolean> {
    const result = await this.repository.delete({ id });
    return (result.affected || 0) > 0;
  }

  /**
   * 批量更新超时的记录
   * 超过72小时未处理的pending状态记录自动标记为待核实
   */
  async batchUpdateTimeout(): Promise<number> {
    const timeoutDate = new Date();
    timeoutDate.setHours(timeoutDate.getHours() - 72);

    const result = await this.repository
      .createQueryBuilder()
      .update(ExpressTracking)
      .set({ 
        status: ExpressStateMachine.States.TIMEOUT,
        remarks: '系统自动标记：超过72小时未处理'
      })
      .where('status = :status', { status: 'pending' })
      .andWhere('createdAt < :timeoutDate', { timeoutDate })
      .execute();

    if (result.affected && result.affected > 0) {
      logger.info(`批量更新超时记录: ${result.affected} 条`);
    }

    return result.affected || 0;
  }

  /**
   * 获取统计数据
   */
  async getStatistics(): Promise<{
    total: number;
    pending: number;
    inTransit: number;
    returned: number;
    signed: number;
    closed: number;
    claimed: number;
  }> {
    const total = await this.repository.count();
    const pending = await this.repository.count({ where: { status: ExpressStateMachine.States.PENDING } });
    const inTransit = await this.repository.count({ where: { status: ExpressStateMachine.States.IN_TRANSIT } });
    const returned = await this.repository.count({ where: { status: ExpressStateMachine.States.RETURNED } });
    const signed = await this.repository.count({ where: { status: ExpressStateMachine.States.SIGNED } });
    const closed = await this.repository.count({ where: { status: ExpressStateMachine.States.CLOSED } });
    const claimed = await this.repository.count({ where: { status: ExpressStateMachine.States.CLAIMED } });

    return { total, pending, inTransit, returned, signed, closed, claimed };
  }

  /**
   * 导出数据
   */
  async exportData(params: {
    startDate?: Date;
    endDate?: Date;
    status?: number;
  }): Promise<ExpressTracking[]> {
    const queryBuilder = this.repository.createQueryBuilder('record');

    if (params.status !== undefined) {
      queryBuilder.andWhere('record.status = :status', { status: params.status });
    }

    if (params.startDate) {
      queryBuilder.andWhere('record.createdAt >= :startDate', { startDate: params.startDate });
    }

    if (params.endDate) {
      queryBuilder.andWhere('record.createdAt <= :endDate', { endDate: params.endDate });
    }

    queryBuilder.orderBy('record.createdAt', 'DESC');

    return queryBuilder.getMany();
  }
}

// 导出单例
export const expressTrackingService = new ExpressTrackingService();
