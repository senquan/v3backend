import { Request, Response } from 'express';
import { DashboardService } from '../services/dashboard.service';
import { successResponse, errorResponse } from '../utils/response';
import { logger } from '../utils/logger';

export class DashboardController {
  private dashboardService: DashboardService;
  
  constructor() {
    this.dashboardService = new DashboardService();
  }
  
  /**
   * 获取仪表盘统计数据
   */
  async getDashboardStats(req: Request, res: Response): Promise<Response> {
    try {
      const userId = (req as any).user?.id;
      
      if (!userId) {
        return errorResponse(res, 401, '未授权', null);
      }
      
      const stats = await this.dashboardService.getDashboardStats(userId);
      
      return successResponse(res, stats, '获取仪表盘统计数据成功');
    } catch (error) {
      logger.error('获取仪表盘统计数据失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
}