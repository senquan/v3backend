import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { DailyCurrentInterestDetail } from '../models/current-interest-detail.entity';
import { DailyFixedInterestDetail } from '../models/fixed-interest-detail.entity';
import { FixedToCurrentInterestDetail } from '../models/f2c-interest-detail.entity';
import { InterestDetailService } from '../services/interest-detail.service';
import { errorResponse, successResponse } from '../utils/response';
import { logger } from '../utils/logger';

const dailyInterestRepository = AppDataSource.getRepository(DailyCurrentInterestDetail);
const dailyFixedRepository = AppDataSource.getRepository(DailyFixedInterestDetail);
const fixedToCurrentRepository = AppDataSource.getRepository(FixedToCurrentInterestDetail);
const interestDetailService = new InterestDetailService(dailyInterestRepository, dailyFixedRepository, fixedToCurrentRepository);

export class InterestDetailController {
  async getDailyInterest(req: Request, res: Response): Promise<Response> {
    try {
      const result = await interestDetailService.getDailyInterestAll(req.query);
      return successResponse(res, result, '查询成功');
    } catch (error) {
      logger.error('获取每日计息明细列表失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  async getDailyFixedInterest(req: Request, res: Response): Promise<Response> {
    try {
      const result = await interestDetailService.getDailyFixedInterestAll(req.query);
      return successResponse(res, result, '查询成功');
    } catch (error) {
      logger.error('获取定期计息明细列表失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  async getFixedToCurrentInterest(req: Request, res: Response): Promise<Response> {
    try {
      const result = await interestDetailService.getFixedToCurrentInterestAll(req.query);
      return successResponse(res, result, '查询成功');
    } catch (error) {
      logger.error('获取定期转活期计息明细列表失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
}

export default new InterestDetailController();
