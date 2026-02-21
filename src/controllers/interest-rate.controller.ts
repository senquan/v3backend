import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { InterestRate } from '../models/interest-rate.entity';
import { InterestRateService } from '../services/interest-rate.service';
import { errorResponse, successResponse } from '../utils/response';
import { logger } from '../utils/logger';

const interestRateRepository = AppDataSource.getRepository(InterestRate);
const interestRateService = new InterestRateService(interestRateRepository);

export class InterestRateController {
  async getAll(req: Request, res: Response): Promise<Response> {
    try {
      const result = await interestRateService.findAll(req.query);
      return successResponse(res, result, '查询成功');
    } catch (error) {
      logger.error('获取利率列表失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  async getById(req: Request, res: Response): Promise<Response> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return errorResponse(res, 400, '无效的利率ID', null);
      }

      const interestRate = await interestRateService.findOne(id);
      if (!interestRate) {
        return errorResponse(res, 404, '利率不存在', null);
      }

      return successResponse(res, interestRate, '查询成功');
    } catch (error) {
      logger.error('获取利率详情失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  async getByType(req: Request, res: Response): Promise<Response> {
    try {
      const rateType = parseInt(req.params.rateType);
      if (isNaN(rateType)) {
        return errorResponse(res, 400, '无效的利率类型', null);
      }

      const interestRates = await interestRateService.findByType(rateType);
      return successResponse(res, interestRates, '查询成功');
    } catch (error) {
      logger.error('按类型获取利率失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  async create(req: Request, res: Response): Promise<Response> {
    try {
      const userId = (req as any).user?.id;

      const {
        rateType,
        rateValue,
        remark
      } = req.body;

      if (!rateType || rateValue === undefined) {
        return errorResponse(res, 400, '利率类型、利率编号和利率值不能为空', null);
      }

      const interestRate = await interestRateService.create({
        rateType,
        rateCode: generateRateCode(),
        rateValue,
        effectiveDate: new Date(),
        expiryDate: null,
        status: 1,
        currency: 'CNY',
        term: null,
        remark: remark || null
      }, userId);

      return successResponse(res, interestRate, '创建成功');
    } catch (error: any) {
      logger.error('创建利率失败:', error);
      return errorResponse(res, 400, error.message || '创建失败', null);
    }
  }

  async confirmUpdate(req: Request, res: Response): Promise<Response> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return errorResponse(res, 400, '无效的利率ID', null);
      }

      const { rateValue, remark } = req.body;
      if (rateValue === undefined) {
        return errorResponse(res, 400, '利率值不能为空', null);
      }

      const userId = (req as any).user?.id;
      const newRate = await interestRateService.confirmUpdate(id, rateValue, generateRateCode(), remark, userId);

      return successResponse(res, newRate, '确认修改成功，原记录已置为无效');
    } catch (error: any) {
      logger.error('确认修改利率失败:', error);
      return errorResponse(res, 400, error.message || '确认修改失败', null);
    }
  }

  async delete(req: Request, res: Response): Promise<Response> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return errorResponse(res, 400, '无效的利率ID', null);
      }

      await interestRateService.remove(id);
      return successResponse(res, null, '删除成功');
    } catch (error: any) {
      logger.error('删除利率失败:', error);
      return errorResponse(res, 400, error.message || '删除失败', null);
    }
  }
}

function generateRateCode() {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0")
  return `RT${year}${month}${day}${random}`
}

export default new InterestRateController();
