import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { TicketFollowUpConfig } from '../models/ticket-follow-up-config.model';
import { TicketFollowUpStage } from '../models/ticket-follow-up-stage.model';
import { TicketFollowUpRecord, FollowUpRecordStatus } from '../models/ticket-follow-up-record.model';
import { Order } from '../models/order.model';
import { Ticket } from '../models/ticket.model';
import { NotificationService } from '../services/notification.service';
import { logger } from '../utils/logger';
import { successResponse, errorResponse } from '../utils/response';

export class FollowUpController {
  private notificationService = new NotificationService();

  // 获取所有跟单配置（含阶段）
  async getConfigs(req: Request, res: Response): Promise<Response> {
    try {
      const configRepo = AppDataSource.getRepository(TicketFollowUpConfig);
      const configs = await configRepo.find({
        relations: ['stages'],
        order: { createdAt: 'DESC' }
      });

      return successResponse(res, { configs }, '获取跟单配置列表成功');
    } catch (error) {
      logger.error('获取跟单配置列表失败:', error);
      return errorResponse(res, 500, '获取跟单配置列表失败', error);
    }
  }

  // 获取单个配置详情
  async getConfig(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const configRepo = AppDataSource.getRepository(TicketFollowUpConfig);
      const config = await configRepo.findOne({
        where: { id: Number(id) },
        relations: ['stages']
      });

      if (!config) {
        return errorResponse(res, 404, '配置不存在', null);
      }

      return successResponse(res, { config }, '获取配置详情成功');
    } catch (error) {
      logger.error('获取配置详情失败:', error);
      return errorResponse(res, 500, '获取配置详情失败', error);
    }
  }

  // 创建跟单配置（含阶段）
  async createConfig(req: Request, res: Response): Promise<Response> {
    try {
      const { name, platformId, baseHours, remark, stages } = req.body;

      if (!name || !baseHours || !stages || !Array.isArray(stages) || stages.length === 0) {
        return errorResponse(res, 400, '请填写配置名称、基础时间，并至少添加一个阶段', null);
      }

      const configRepo = AppDataSource.getRepository(TicketFollowUpConfig);
      const stageRepo = AppDataSource.getRepository(TicketFollowUpStage);

      const config = new TicketFollowUpConfig();
      config.name = name;
      config.platformId = platformId ?? null;
      config.baseHours = Number(baseHours);
      config.remark = remark ?? null;
      config.isActive = 1;

      const savedConfig = await configRepo.save(config);

      // 创建阶段，计算累计小时数
      let cumulativeHours = Number(baseHours);
      const stageEntities: TicketFollowUpStage[] = [];

      for (let i = 0; i < stages.length; i++) {
        const s = stages[i];
        const stage = new TicketFollowUpStage();
        stage.configId = savedConfig.id;
        stage.stageOrder = i + 1;
        stage.offsetHours = i === 0 ? Number(baseHours) : Number(s.offsetHours);
        stage.cumulativeHours = cumulativeHours;
        stage.scriptName = s.scriptName || `话术${String.fromCharCode(65 + i)}`;
        stage.script = s.script || '';

        stageEntities.push(stage);

        if (i > 0) {
          cumulativeHours += Number(s.offsetHours);
        }
      }

      await stageRepo.save(stageEntities);

      return successResponse(res, { id: savedConfig.id }, '创建跟单配置成功');
    } catch (error) {
      logger.error('创建跟单配置失败:', error);
      return errorResponse(res, 500, '创建跟单配置失败', error);
    }
  }

  // 更新跟单配置
  async updateConfig(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { name, platformId, baseHours, remark, isActive, stages } = req.body;

      const configRepo = AppDataSource.getRepository(TicketFollowUpConfig);
      const stageRepo = AppDataSource.getRepository(TicketFollowUpStage);

      const config = await configRepo.findOne({ where: { id: Number(id) } });
      if (!config) {
        return errorResponse(res, 404, '配置不存在', null);
      }

      if (name !== undefined) config.name = name;
      if (platformId !== undefined) config.platformId = platformId ?? null;
      if (baseHours !== undefined) config.baseHours = Number(baseHours);
      if (remark !== undefined) config.remark = remark ?? null;
      if (isActive !== undefined) config.isActive = Number(isActive);

      await configRepo.save(config);

      // 如果传入了 stages，则全量替换
      if (stages && Array.isArray(stages)) {
        await stageRepo.delete({ configId: config.id });

        let cumulativeHours = Number(config.baseHours);
        const stageEntities: TicketFollowUpStage[] = [];

        for (let i = 0; i < stages.length; i++) {
          const s = stages[i];
          const stage = new TicketFollowUpStage();
          stage.configId = config.id;
          stage.stageOrder = i + 1;
          stage.offsetHours = i === 0 ? Number(config.baseHours) : Number(s.offsetHours);
          stage.cumulativeHours = cumulativeHours;
          stage.scriptName = s.scriptName || `话术${String.fromCharCode(65 + i)}`;
          stage.script = s.script || '';

          stageEntities.push(stage);

          if (i > 0) {
            cumulativeHours += Number(s.offsetHours);
          }
        }

        await stageRepo.save(stageEntities);
      }

      return successResponse(res, null, '更新跟单配置成功');
    } catch (error) {
      logger.error('更新跟单配置失败:', error);
      return errorResponse(res, 500, '更新跟单配置失败', error);
    }
  }

  // 删除跟单配置
  async deleteConfig(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const configRepo = AppDataSource.getRepository(TicketFollowUpConfig);
      const stageRepo = AppDataSource.getRepository(TicketFollowUpStage);

      const config = await configRepo.findOne({ where: { id: Number(id) } });
      if (!config) {
        return errorResponse(res, 404, '配置不存在', null);
      }

      // 检查是否有进行中的跟单记录
      const recordRepo = AppDataSource.getRepository(TicketFollowUpRecord);
      const activeRecordCount = await recordRepo.count({
        where: {
          configId: config.id,
          status: FollowUpRecordStatus.PENDING
        }
      });

      if (activeRecordCount > 0) {
        return errorResponse(res, 400, `该配置还有 ${activeRecordCount} 条待触发的跟单记录，请先处理后再删除`, null);
      }

      await stageRepo.delete({ configId: config.id });
      await configRepo.remove(config);

      return successResponse(res, null, '删除跟单配置成功');
    } catch (error) {
      logger.error('删除跟单配置失败:', error);
      return errorResponse(res, 500, '删除跟单配置失败', error);
    }
  }

  // 获取跟单记录列表
  async getRecords(req: Request, res: Response): Promise<Response> {
    try {
      const { orderId, status, configId, keyword, page = 1, pageSize = 20 } = req.query;

      const recordRepo = AppDataSource.getRepository(TicketFollowUpRecord);
      const queryBuilder = recordRepo.createQueryBuilder('record')
        .leftJoinAndSelect('record.order', 'order')
        .leftJoinAndSelect('record.config', 'config')
        .leftJoinAndSelect('record.stage', 'stage')
        .leftJoinAndSelect('record.ticket', 'ticket');

      if (orderId) {
        queryBuilder.andWhere('record.orderId = :orderId', { orderId: Number(orderId) });
      }
      if (status !== undefined && status !== '') {
        queryBuilder.andWhere('record.status = :status', { status: Number(status) });
      }
      if (configId) {
        queryBuilder.andWhere('record.configId = :configId', { configId: Number(configId) });
      }
      if (keyword) {
        queryBuilder.andWhere('(order.name LIKE :keyword OR config.name LIKE :keyword2)', {
          keyword: `%${keyword}%`,
          keyword2: `%${keyword}%`
        });
      }

      queryBuilder.orderBy('record.triggerAt', 'DESC');

      const pageNum = Number(page);
      const size = Number(pageSize);
      queryBuilder.skip((pageNum - 1) * size).take(size);

      const [records, total] = await queryBuilder.getManyAndCount();

      return successResponse(res, { records, total, page: pageNum, pageSize: size }, '获取跟单记录列表成功');
    } catch (error) {
      logger.error('获取跟单记录列表失败:', error);
      return errorResponse(res, 500, '获取跟单记录列表失败', error);
    }
  }

  // 完成跟单（制单人点击"完成"）
  async completeRecord(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;

      const recordRepo = AppDataSource.getRepository(TicketFollowUpRecord);
      const record = await recordRepo.findOne({
        where: { id: Number(id) },
        relations: ['ticket']
      });

      if (!record) {
        return errorResponse(res, 404, '跟单记录不存在', null);
      }

      if (record.status !== FollowUpRecordStatus.TRIGGERED) {
        return errorResponse(res, 400, '该跟单记录当前状态不允许完成操作', null);
      }

      record.status = FollowUpRecordStatus.COMPLETED;
      record.completedAt = new Date();
      await recordRepo.save(record);

      // 同时关闭关联的工单
      if (record.ticketId && record.ticket) {
        const ticketRepo = AppDataSource.getRepository(Ticket);
        record.ticket.status = 4; // 已关闭
        record.ticket.closedAt = new Date();
        await ticketRepo.save(record.ticket);
      }

      return successResponse(res, null, '跟单完成成功');
    } catch (error) {
      logger.error('完成跟单失败:', error);
      return errorResponse(res, 500, '完成跟单失败', error);
    }
  }

  // 获取跟单看板统计
  async getDashboard(req: Request, res: Response): Promise<Response> {
    try {
      const recordRepo = AppDataSource.getRepository(TicketFollowUpRecord);

      const pendingCount = await recordRepo.count({ where: { status: FollowUpRecordStatus.PENDING } });
      const triggeredCount = await recordRepo.count({ where: { status: FollowUpRecordStatus.TRIGGERED } });
      const completedCount = await recordRepo.count({ where: { status: FollowUpRecordStatus.COMPLETED } });
      const skippedCount = await recordRepo.count({ where: { status: FollowUpRecordStatus.SKIPPED } });

      // 获取最近 7 天的触发记录统计
      const last7Days = await recordRepo.createQueryBuilder('record')
        .select('DATE(record.trigger_at)', 'date')
        .addSelect('COUNT(*)', 'total')
        .addSelect('SUM(CASE WHEN record.status = 2 THEN 1 ELSE 0 END)', 'completed')
        .addSelect('SUM(CASE WHEN record.status = 3 THEN 1 ELSE 0 END)', 'skipped')
        .where('record.trigger_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)')
        .groupBy('DATE(record.trigger_at)')
        .orderBy('date', 'ASC')
        .getRawMany();

      return successResponse(res, {
        summary: { pendingCount, triggeredCount, completedCount, skippedCount },
        last7Days
      }, '获取跟单看板数据成功');
    } catch (error) {
      logger.error('获取跟单看板数据失败:', error);
      return errorResponse(res, 500, '获取跟单看板数据失败', error);
    }
  }

  // 手动为指定订单生成跟单记录（管理员操作）
  async generateRecords(req: Request, res: Response): Promise<Response> {
    try {
      const { orderId, configId } = req.body;

      if (!orderId || !configId) {
        return errorResponse(res, 400, '请提供订单ID和配置ID', null);
      }

      const orderRepo = AppDataSource.getRepository(Order);
      const order = await orderRepo.findOne({ where: { id: Number(orderId) } });
      if (!order) {
        return errorResponse(res, 404, '订单不存在', null);
      }

      // 检查订单是否已成交
      if (order.status >= 1 && order.status !== 7) {
        return errorResponse(res, 400, '该订单已成交，无需跟单', null);
      }

      const configRepo = AppDataSource.getRepository(TicketFollowUpConfig);
      const config = await configRepo.findOne({
        where: { id: Number(configId) },
        relations: ['stages']
      });
      if (!config) {
        return errorResponse(res, 404, '配置不存在', null);
      }

      // 检查该订单是否已有跟单记录
      const recordRepo = AppDataSource.getRepository(TicketFollowUpRecord);
      const existingCount = await recordRepo.count({ where: { orderId: order.id, configId: config.id } });
      if (existingCount > 0) {
        return errorResponse(res, 400, '该订单已存在跟单记录', null);
      }

      const baseTime = new Date(order.createdAt);
      const records = this.createRecordsFromStages(order.id, config, config.stages, baseTime);
      await recordRepo.save(records);

      return successResponse(res, { count: records.length }, '生成跟单记录成功');
    } catch (error) {
      logger.error('生成跟单记录失败:', error);
      return errorResponse(res, 500, '生成跟单记录失败', error);
    }
  }

  // 辅助方法：根据阶段列表创建跟单记录
  private createRecordsFromStages(
    orderId: number,
    config: TicketFollowUpConfig,
    stages: TicketFollowUpStage[],
    baseTime: Date
  ): TicketFollowUpRecord[] {
    const sortedStages = [...stages].sort((a, b) => a.stageOrder - b.stageOrder);

    return sortedStages.map(stage => {
      const record = new TicketFollowUpRecord();
      record.orderId = orderId;
      record.configId = config.id;
      record.stageId = stage.id;
      record.stageOrder = stage.stageOrder;
      record.status = FollowUpRecordStatus.PENDING;
      record.triggerAt = new Date(baseTime.getTime() + Number(stage.cumulativeHours) * 3600000);
      return record;
    });
  }
}
