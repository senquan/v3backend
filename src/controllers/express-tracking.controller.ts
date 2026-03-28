import { Request, Response } from 'express';
import { expressTrackingService } from '../services/express-tracking.service';
import { expressLogisticsService, LogisticsResult } from '../services/express-logistics.service';
import { ExpressStateMachine } from '../state-machines/express.state-machine';
import { successResponse, errorResponse } from '../utils/response';
import { logger } from '../utils/logger';

/**
 * 快递跟踪控制器
 */
export class ExpressTrackingController {
  private stateMachine = new ExpressStateMachine();

  /**
   * 创建快递拦截记录
   * POST /api/v1/express/create
   */
  async create(req: Request, res: Response) {
    try {
      const { expressCompanyId, trackingNumber, requestType, requestReason, orderId } = req.body;
      const operator = (req as any).user?.username || '';

      if (!expressCompanyId || !trackingNumber || !requestType) {
        return errorResponse(res, 400, '缺少必要参数');
      }



      const record = await expressTrackingService.createInterception({
        expressCompanyId,
        trackingNumber,
        requestType,
        requestReason,
        operator,
        orderId
      });

      return successResponse(res, record, '创建成功');
    } catch (error: any) {
      logger.error('创建快递记录失败:', error);
      return errorResponse(res, 500, error.message || '创建失败');
    }
  }

  /**
   * 获取快递跟踪详情
   * GET /api/v1/express/:id
   */
  async getDetail(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const record = await expressTrackingService.findById(id);

      if (!record) {
        return errorResponse(res, 404, '记录不存在');
      }

      return successResponse(res, record, '获取成功');
    } catch (error: any) {
      logger.error('获取快递详情失败:', error);
      return errorResponse(res, 500, error.message || '获取失败');
    }
  }

  /**
   * 根据单号查询
   * GET /api/v1/express/number/:trackingNumber
   */
  async getByNumber(req: Request, res: Response) {
    try {
      const { trackingNumber } = req.params;
      const record = await expressTrackingService.findByTrackingNumber(trackingNumber);

      if (!record) {
        return errorResponse(res, 404, '记录不存在');
      }

      return successResponse(res, record, '获取成功');
    } catch (error: any) {
      logger.error('查询快递失败:', error);
      return errorResponse(res, 500, error.message || '查询失败');
    }
  }

  /**
   * 获取快递列表
   * GET /api/v1/express?page=1&size=20&status=pending&requestType=interception
   */
  async getList(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const size = parseInt(req.query.size as string) || 20;
      const status = req.query.status as string;
      const requestType = req.query.requestType as string;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

      const result = await expressTrackingService.findList({
        page,
        size,
        status,
        requestType,
        startDate,
        endDate
      });

      return successResponse(res, result, '获取成功');
    } catch (error: any) {
      logger.error('获取列表失败:', error);
      return errorResponse(res, 500, error.message || '获取失败');
    }
  }

  /**
   * 更新状态
   * PUT /api/v1/express/:id/status
   */
  async updateStatus(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { status, remarks, returnedAt, signedAt, warehouseReceivedAt } = req.body;
      const operator = (req as any).user?.username || '';

      if (!status) {
        return errorResponse(res, 400, '缺少状态参数');
      }

      const record = await expressTrackingService.updateStatus(id, {
        status,
        operator,
        remarks,
        returnedAt: returnedAt ? new Date(returnedAt) : undefined,
        signedAt: signedAt ? new Date(signedAt) : undefined,
        warehouseReceivedAt: warehouseReceivedAt ? new Date(warehouseReceivedAt) : undefined,
      });

      if (!record) {
        return errorResponse(res, 404, '记录不存在');
      }

      return successResponse(res, record, '更新成功');
    } catch (error: any) {
      logger.error('更新状态失败:', error);
      return errorResponse(res, 500, error.message || '更新失败');
    }
  }

  /**
   * 入库操作
   * POST /api/v1/express/:id/warehouse-in
   */
  async warehouseIn(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const operator = (req as any).user?.username || '';

      const record = await expressTrackingService.warehouseIn(id, operator);

      if (!record) {
        return errorResponse(res, 404, '记录不存在');
      }

      return successResponse(res, record, '入库成功');
    } catch (error: any) {
      logger.error('入库操作失败:', error);
      return errorResponse(res, 500, error.message || '入库失败');
    }
  }

  /**
   * 完结记录
   * POST /api/v1/express/:id/close
   */
  async closeRecord(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const operator = (req as any).user?.username || '';
      const { remarks } = req.body;

      const record = await expressTrackingService.closeRecord(id, operator, remarks);

      if (!record) {
        return errorResponse(res, 404, '记录不存在');
      }

      return successResponse(res, record, '已完结');
    } catch (error: any) {
      logger.error('完结记录失败:', error);
      return errorResponse(res, 500, error.message || '操作失败');
    }
  }

  /**
   * 查询物流信息
   * GET /api/v1/express/logistics/:trackingNumber
   */
  async getLogistics(req: Request, res: Response) {
    try {
      const { trackingNumber } = req.params;
      const company = req.query.company as string;

      const result: LogisticsResult = await expressLogisticsService.query(trackingNumber, company);

      return successResponse(res, result, result.success ? '查询成功' : result.error || '查询失败');
    } catch (error: any) {
      logger.error('查询物流失败:', error);
      return errorResponse(res, 500, error.message || '查询失败');
    }
  }

  /**
   * 获取统计数据
   * GET /api/v1/express/statistics
   */
  async getStatistics(req: Request, res: Response) {
    try {
      const stats = await expressTrackingService.getStatistics();

      // 状态名称到数字值的映射
      const statusNameToValue: Record<string, number> = {
        pending: ExpressStateMachine.States.PENDING,
        inTransit: ExpressStateMachine.States.IN_TRANSIT,
        returned: ExpressStateMachine.States.RETURNED,
        signed: ExpressStateMachine.States.SIGNED,
        closed: ExpressStateMachine.States.CLOSED,
        claimed: ExpressStateMachine.States.CLAIMED,
      };

      // 需要展示的状态键
      const statusKeys = ['pending', 'inTransit', 'returned', 'signed', 'closed', 'claimed'];

      // 添加状态显示名称和颜色
      const statusDetails = statusKeys.map(key => {
        const statusValue = statusNameToValue[key];
        return {
          status: key,
          statusValue,
          count: (stats as any)[key] || 0,
          displayName: ExpressStateMachine.getStateDisplayName(statusValue),
          color: ExpressStateMachine.getStateColor(statusValue)
        };
      });

      const statsWithDisplay = {
        ...stats,
        statusDetails
      };

      return successResponse(res, statsWithDisplay, '获取成功');
    } catch (error: any) {
      logger.error('获取统计失败:', error);
      return errorResponse(res, 500, error.message || '获取失败');
    }
  }

  /**
   * 导出数据
   * GET /api/v1/express/export
   */
  async exportData(req: Request, res: Response) {
    try {
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const statusParam = req.query.status as string;
      const status = statusParam ? parseInt(statusParam, 10) : undefined;

      const data = await expressTrackingService.exportData({ startDate, endDate, status });

      // 设置响应头为Excel下载
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=express_tracking_${Date.now()}.xlsx`);

      // 生成CSV格式（简单实现）
      const csvHeader = 'ID,快递公司,单号,类型,状态,退回时间,签收时间,入库时间,备注,操作人,创建时间\n';
      const csvData = data.map(item => [
        item.id,
        item.expressCompany,
        item.trackingNumber,
        item.requestType,
        item.status,
        item.returnedAt || '',
        item.signedAt || '',
        item.warehouseReceivedAt || '',
        (item.remarks || '').replace(/,/g, ';'),
        item.operator || '',
        item.createdAt
      ].join(',')).join('\n');

      return res.send(csvHeader + csvData);
    } catch (error: any) {
      logger.error('导出数据失败:', error);
      return errorResponse(res, 500, error.message || '导出失败');
    }
  }

  /**
   * 删除记录
   * DELETE /api/v1/express/:id
   */
  async delete(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);

      const success = await expressTrackingService.deleteRecord(id);

      if (!success) {
        return errorResponse(res, 404, '记录不存在');
      }

      return successResponse(res, null, '删除成功');
    } catch (error: any) {
      logger.error('删除记录失败:', error);
      return errorResponse(res, 500, error.message || '删除失败');
    }
  }
}

export const expressTrackingController = new ExpressTrackingController();
