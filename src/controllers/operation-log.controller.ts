import { Response } from 'express';
import { OperationLogService } from '../services/operation-log.service';
import { CreateOperationLogDto, UpdateOperationLogDto, OperationLogQueryDto } from '../dtos/operation-log.dto';
import { successResponse, errorResponse } from '../utils/response';
import { validate } from 'class-validator';

export class OperationLogController {
  private operationLogService: OperationLogService;

  constructor() {
    this.operationLogService = new OperationLogService();
  }

  async getLogList(req: any, res: Response) {
    try {
      const result = await this.operationLogService.findAll(req.query);
      return successResponse(res, result, '查询成功');
    } catch (error: any) {
      return errorResponse(res, 500, `查询失败: ${error.message}`);
    }
  }

  async getLogDetail(req: any, res: Response) {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return errorResponse(res, 400, '无效的日志ID');
      }

      const log = await this.operationLogService.findOne(id);
      
      if (!log) {
        return errorResponse(res, 404, '日志不存在');
      }

      return successResponse(res, log, '查询成功');
    } catch (error: any) {
      return errorResponse(res, 500, `查询失败: ${error.message}`);
    }
  }

  async createLog(req: any, res: Response) {
    try {
      const createDto: CreateOperationLogDto = req.body;
      
      // 设置用户信息
      const userId = (req as any).user?.id || 1;
      createDto.userId = userId;
      createDto.createdBy = userId;
      createDto.updatedBy = userId;

      // 验证创建参数
      const errors = await validate(createDto);
      if (errors.length > 0) {
        return errorResponse(res, 400, '参数验证失败', errors);
      }

      const log = await this.operationLogService.create(createDto);
      return successResponse(res, log, '创建成功');
    } catch (error: any) {
      return errorResponse(res, 500, `创建失败: ${error.message}`);
    }
  }

  async deleteLog(req: any, res: Response) {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return errorResponse(res, 400, '无效的日志ID');
      }

      const existingLog = await this.operationLogService.findOne(id);
      if (!existingLog) {
        return errorResponse(res, 404, '日志不存在');
      }

      await this.operationLogService.remove(id);
      return successResponse(res, null, '删除成功');
    } catch (error: any) {
      return errorResponse(res, 500, `删除失败: ${error.message}`);
    }
  }

  async batchDeleteLogs(req: any, res: Response) {
    try {
      const { ids } = req.body;
      
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return errorResponse(res, 400, '请选择要删除的日志');
      }

      const numIds = ids.map((id: string | number) => parseInt(id as string));
      const invalidIds = numIds.filter(isNaN);
      
      if (invalidIds.length > 0) {
        return errorResponse(res, 400, '包含无效的日志ID');
      }

      const result = await this.operationLogService.batchDelete(numIds);
      return successResponse(res, { deleted: result.affected }, `删除成功，共删除 ${result.affected} 条记录`);
    } catch (error: any) {
      return errorResponse(res, 500, `批量删除失败: ${error.message}`);
    }
  }

  async getLogStatistics(req: any, res: Response) {
    try {
      const { startDate, endDate } = req.query;
      
      const query = {
        startDate: startDate || null,
        endDate: endDate || null
      };

      const statistics = await this.operationLogService.getStatistics(query);
      return successResponse(res, statistics, '统计成功');
    } catch (error: any) {
      return errorResponse(res, 500, `统计失败: ${error.message}`);
    }
  }

  // 获取操作类型选项
  async getOperationTypes(req: any, res: Response) {
    try {
      const operationTypes = [
        { value: 1, label: '新增' },
        { value: 2, label: '修改' },
        { value: 3, label: '删除' },
        { value: 4, label: '查询' },
        { value: 5, label: '导出' },
        { value: 6, label: '登录' },
        { value: 7, label: '登出' }
      ];
      
      return successResponse(res, operationTypes, '获取成功');
    } catch (error: any) {
      return errorResponse(res, 500, `获取失败: ${error.message}`);
    }
  }

  // 获取状态选项
  async getStatusOptions(req: any, res: Response) {
    try {
      const statusOptions = [
        { value: 1, label: '成功' },
        { value: 2, label: '失败' }
      ];
      
      return successResponse(res, statusOptions, '获取成功');
    } catch (error: any) {
      return errorResponse(res, 500, `获取失败: ${error.message}`);
    }
  }
}