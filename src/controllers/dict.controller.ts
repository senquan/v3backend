import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Dict } from '../models/dict.entity';
import { RedisCacheService } from '../services/cache.service';
import { DictService } from '../services/dict.service';
import { errorResponse, successResponse } from '../utils/response';
import { logger } from '../utils/logger';

const dictRepository = AppDataSource.getRepository(Dict);
const cacheService = new RedisCacheService();
const dictService = new DictService(dictRepository, cacheService);

export class DictController {
  async getAll(req: Request, res: Response): Promise<Response> {
    try {
      const result = await dictService.findAll(req.query);
      return successResponse(res, result, '查询成功');
    } catch (error) {
      logger.error('获取字典列表失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  async getById(req: Request, res: Response): Promise<Response> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return errorResponse(res, 400, '无效的字典ID', null);
      }

      const dict = await dictService.findOne(id);
      if (!dict) {
        return errorResponse(res, 404, '字典不存在', null);
      }

      return successResponse(res, dict, '查询成功');
    } catch (error) {
      logger.error('获取字典详情失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  async getGroups(req: Request, res: Response): Promise<Response> {
    try {
      const groups = await dictService.getAllGroups();
      return successResponse(res, groups, '查询成功');
    } catch (error) {
      logger.error('获取字典分组失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  async getByGroup(req: Request, res: Response): Promise<Response> {
    try {
      const group = parseInt(req.params.group);
      if (isNaN(group)) {
        return errorResponse(res, 400, '无效的分组', null);
      }

      const records = await dictService.findByGroup(group);
      return successResponse(res, { records }, '查询成功');
    } catch (error) {
      logger.error('按分组获取字典失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  async getNameByValue(req: Request, res: Response): Promise<Response> {
    try {
      const group = parseInt(req.params.group);
      const value = req.params.value;
      if (isNaN(group)) {
        return errorResponse(res, 400, '无效的分组', null);
      }

      const name = await dictService.getNameByValueFromCache(group, value);
      return successResponse(res, name, '查询成功');
    } catch (error) {
      logger.error('获取字典名称失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  async getDictMap(req: Request, res: Response): Promise<Response> {
    try {
      const group = parseInt(req.params.group);
      if (isNaN(group)) {
        return errorResponse(res, 400, '无效的分组', null);
      }

      const map = await dictService.getDictMap(group);
      const result: Record<string, string> = {};
      map.forEach((value, key) => {
        result[key] = value;
      });
      return successResponse(res, result, '查询成功');
    } catch (error) {
      logger.error('获取字典映射失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  async create(req: Request, res: Response): Promise<Response> {
    try {
      const { group, name, value, sort, status } = req.body;

      if (!group || !name || !value) {
        return errorResponse(res, 400, '分组、名称和值不能为空', null);
      }

      const dict = await dictService.create({
        group,
        name,
        value,
        sort: sort || 0
      });

      return successResponse(res, dict, '创建成功');
    } catch (error: any) {
      logger.error('创建字典失败:', error);
      return errorResponse(res, 400, error.message || '创建失败', null);
    }
  }

  async update(req: Request, res: Response): Promise<Response> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return errorResponse(res, 400, '无效的字典ID', null);
      }

      const { group, name, value, sort, status } = req.body;

      const dict = await dictService.update(id, {
        group,
        name,
        value,
        sort
      });

      return successResponse(res, dict, '更新成功');
    } catch (error: any) {
      logger.error('更新字典失败:', error);
      return errorResponse(res, 400, error.message || '更新失败', null);
    }
  }

  async delete(req: Request, res: Response): Promise<Response> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return errorResponse(res, 400, '无效的字典ID', null);
      }

      await dictService.remove(id);
      return successResponse(res, null, '删除成功');
    } catch (error: any) {
      logger.error('删除字典失败:', error);
      return errorResponse(res, 400, error.message || '删除失败', null);
    }
  }
}

export default new DictController();
