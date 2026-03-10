import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { ClearingSummary } from '../models/clearing-summary.entity';
import { ClearingSummaryService } from '../services/clearing-summary.service';
import { errorResponse, successResponse } from '../utils/response';
import { logger } from '../utils/logger';

const clearingSummaryRepository = AppDataSource.getRepository(ClearingSummary);
const clearingSummaryService = new ClearingSummaryService(clearingSummaryRepository);

export class ClearingSummaryController {
  async getAll(req: Request, res: Response): Promise<Response> {
    try {
      const result = await clearingSummaryService.findAll(req.query);
      return successResponse(res, result, '查询成功');
    } catch (error) {
      logger.error('获取清算汇总列表失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  async getById(req: Request, res: Response): Promise<Response> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return errorResponse(res, 400, '无效的ID', null);
      }

      const summary = await clearingSummaryService.findOne(id, req.query);
      if (!summary) {
        return errorResponse(res, 404, '记录不存在', null);
      }

      return successResponse(res, summary, '查询成功');
    } catch (error) {
      logger.error('获取清算汇总详情失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 快照管理相关方法
  async createSnapshot(req: any, res: Response): Promise<Response> {
    try {
      let { name, cutoffDate } = req.body;
      const userId = req.user?.id;
      if (!userId) {
        return errorResponse(res, 400, '未授权', null);
      }

      if (!cutoffDate) {
        cutoffDate = new Date().toISOString();
      }

      if (!name) {
        name = `快照${cutoffDate.split('T')[0]}`
      }

      const snapshot = await clearingSummaryService.createSnapshot(name, new Date(cutoffDate), userId);
      return successResponse(res, snapshot, '快照创建成功');
    } catch (error: any) {
      logger.error('创建快照失败:', error);
      return errorResponse(res, 500, `创建失败: ${error.message}`);
    }
  }

  async getSnapshotList(req: Request, res: Response): Promise<Response> {
    try {
      const result = await clearingSummaryService.getSnapshotList(req.query);
      return successResponse(res, result, '查询成功');
    } catch (error: any) {
      return errorResponse(res, 500, `查询失败: ${error.message}`);
    }
  }

  async getSnapshotData(req: Request, res: Response): Promise<Response> {
    try {
      const snapshotId = parseInt(req.params.id);
      const result = await clearingSummaryService.getSnapshotData(snapshotId);
      return successResponse(res, result, '查询成功');
    } catch (error: any) {
      return errorResponse(res, 500, `查询失败: ${error.message}`);
    }
  }

  async getDrillDown(req: Request, res: Response): Promise<Response> {
    try {
      const { snapshotId, companyId, field } = req.query;
      const result = await clearingSummaryService.getSnapshotDrillDown(
        Number(snapshotId),
        Number(companyId),
        field as string
      );
      return successResponse(res, result, '查询成功');
    } catch (error: any) {
      return errorResponse(res, 500, `查询失败: ${error.message}`);
    }
  }

  async update(req: Request, res: Response): Promise<Response> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return errorResponse(res, 400, '无效的ID', null);
      }

      const result = await clearingSummaryService.update(id, req.body);
      if (!result) {
        return errorResponse(res, 404, '记录不存在', null);
      }

      return successResponse(res, result, '更新成功');
    } catch (error) {
      logger.error('更新清算汇总失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
}

export default new ClearingSummaryController();
