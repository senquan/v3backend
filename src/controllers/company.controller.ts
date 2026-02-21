import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { CompanyInfo } from '../models/company-info.entity';
import { RedisCacheService } from '../services/cache.service';
import { CompanyService } from '../services/company-management.service';
import { errorResponse, successResponse } from '../utils/response';
import { logger } from '../utils/logger';

const companyRepository = AppDataSource.getRepository(CompanyInfo);
const cacheService = new RedisCacheService();
const companyService = new CompanyService(companyRepository, cacheService);

export class CompanyController {
  async getAll(req: Request, res: Response): Promise<Response> {
    try {
      const result = await companyService.findAll(req.query);
      return res.json({
        code: 0,
        message: '查询成功',
        data: result
      });
    } catch (error) {
      logger.error('获取单位列表失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  async getTree(req: Request, res: Response): Promise<Response> {
    try {
      const tree = await companyService.getTree();
      return res.json({
        code: 0,
        message: '查询成功',
        data: tree
      });
    } catch (error) {
      logger.error('获取单位树失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  async getById(req: Request, res: Response): Promise<Response> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return errorResponse(res, 400, '无效的单位ID', null);
      }

      const company = await companyService.findOne(id);
      if (!company) {
        return errorResponse(res, 404, '单位不存在', null);
      }

      return res.json({
        code: 0,
        message: '查询成功',
        data: company
      });
    } catch (error) {
      logger.error('获取单位详情失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  async getByParentId(req: Request, res: Response): Promise<Response> {
    try {
      const parentCompanyId = req.params.parentId === 'null' ? null : parseInt(req.params.parentId);
      
      const companies = await companyService.findByParentId(parentCompanyId);
      return res.json({
        code: 0,
        message: '查询成功',
        data: companies
      });
    } catch (error) {
      logger.error('获取下级单位失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  async create(req: Request, res: Response): Promise<Response> {
    try {
      const userId = (req as any).user?.id;
      const userName = (req as any).user?.name || 'system';
      
      const { companyCode, companyName, parentCompanyId, status } = req.body;

      if (!companyCode || !companyName) {
        return errorResponse(res, 400, '单位编号和单位名称不能为空', null);
      }

      const company = await companyService.create({
        companyCode,
        companyName,
        parentCompanyId: parentCompanyId || null,
        status: status || 1
      }, userId, userName);

      return res.json({
        code: 0,
        message: '创建成功',
        data: company
      });
    } catch (error: any) {
      logger.error('创建单位失败:', error);
      return errorResponse(res, 400, error.message || '创建失败', null);
    }
  }

  async update(req: Request, res: Response): Promise<Response> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return errorResponse(res, 400, '无效的单位ID', null);
      }

      const userName = (req as any).user?.name || 'system';
      const { companyName, parentCompanyId, status } = req.body;

      const company = await companyService.update(id, {
        companyName,
        parentCompanyId,
        status
      }, userName);

      return res.json({
        code: 0,
        message: '更新成功',
        data: company
      });
    } catch (error: any) {
      logger.error('更新单位失败:', error);
      return errorResponse(res, 400, error.message || '更新失败', null);
    }
  }

  async delete(req: Request, res: Response): Promise<Response> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return errorResponse(res, 400, '无效的单位ID', null);
      }

      await companyService.remove(id);

      return res.json({
        code: 0,
        message: '删除成功',
        data: null
      });
    } catch (error: any) {
      logger.error('删除单位失败:', error);
      return errorResponse(res, 400, error.message || '删除失败', null);
    }
  }

  async updateStatus(req: Request, res: Response): Promise<Response> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return errorResponse(res, 400, '无效的单位ID', null);
      }

      const { status } = req.body;
      if (status === undefined || (status !== 0 && status !== 1)) {
        return errorResponse(res, 400, '状态值无效', null);
      }

      const userName = (req as any).user?.name || 'system';
      const company = await companyService.updateStatus(id, status, userName);

      return res.json({
        code: 0,
        message: '状态更新成功',
        data: company
      });
    } catch (error: any) {
      logger.error('更新单位状态失败:', error);
      return errorResponse(res, 400, error.message || '更新失败', null);
    }
  }
}

export default new CompanyController();
