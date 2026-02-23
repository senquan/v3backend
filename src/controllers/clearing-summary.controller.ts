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

      const summary = await clearingSummaryService.findOne(id);
      if (!summary) {
        return errorResponse(res, 404, '记录不存在', null);
      }

      return successResponse(res, summary, '查询成功');
    } catch (error) {
      logger.error('获取清算汇总详情失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
}

export default new ClearingSummaryController();
