import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { SpecGroup } from '../models/spec-group.model';
import { SpecItem } from '../models/spec-item.model';
import { logger } from '../utils/logger';
import { errorResponse, successResponse } from '../utils/response';

export class SpecController {
  // 获取规格组列表
  async getGroupList(req: Request, res: Response): Promise<Response> {
    try {
      const { page = 1, pageSize = 20, keyword } = req.query;
      
      // 构建查询条件
      const queryBuilder = AppDataSource.getRepository(SpecGroup)
        .createQueryBuilder('specGroup');
      
      // 添加筛选条件
      if (keyword) {
        queryBuilder.andWhere('specGroup.name LIKE :keyword', { keyword: `%${keyword}%` });
      }
      
      // 计算分页
      const pageNum = Number(page);
      const pageSizeNum = Number(pageSize);
      const skip = (pageNum - 1) * pageSizeNum;
      
      // 获取总数和分页数据
      const [groups, total] = await queryBuilder
        .orderBy('specGroup.id', 'ASC')
        .skip(skip)
        .take(pageSizeNum)
        .getManyAndCount();
      
      return successResponse(res, {
        groups,
        total,
        page: pageNum,
        pageSize: pageSizeNum
      }, '获取规格组列表成功');
    } catch (error) {
      logger.error('获取规格组列表失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  async getGroupDetail(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;

      const specGroupRepository = AppDataSource.getRepository(SpecGroup); 
      const specGroup = await specGroupRepository.findOne({
        where: { id: Number(id) },
        relations: ['specItems']
      })
      if (!specGroup) {
        return errorResponse(res, 404, '规格组不存在', null); 
      }
      return successResponse(res, specGroup, '获取规格组成功');
    } catch (error) {
      logger.error('获取规格组失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null); 
    }
  }
  
  // 获取所有规格组（用于下拉选择）
  async getAllGroups(req: Request, res: Response): Promise<Response> {
    try {
      const groups = await AppDataSource.getRepository(SpecGroup)
        .createQueryBuilder('specGroup')
        .orderBy('specGroup.id', 'ASC')
        .getMany();
      
      return successResponse(res, groups, '获取所有规格组成功');
    } catch (error) {
      logger.error('获取所有规格组失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
  
  // 创建规格组
  async createGroup(req: Request, res: Response): Promise<Response> {
    try {
      const { name } = req.body;
      
      if (!name) {
        return errorResponse(res, 400, '规格组名称不能为空', null);
      }
      
      // 检查规格组名称是否已存在
      const specGroupRepository = AppDataSource.getRepository(SpecGroup);
      const existingGroup = await specGroupRepository.findOne({
        where: { name }
      });
      
      if (existingGroup) {
        return errorResponse(res, 400, '规格组名称已存在', null);
      }
      
      // 创建新规格组
      const specGroup = new SpecGroup();
      specGroup.name = name;
      
      const savedGroup = await specGroupRepository.save(specGroup);
      
      return successResponse(res, savedGroup, '创建规格组成功');
    } catch (error) {
      logger.error('创建规格组失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
  
  // 更新规格组
  async updateGroup(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { name } = req.body;
      
      if (!name) {
        return errorResponse(res, 400, '规格组名称不能为空', null);
      }
      
      const specGroupRepository = AppDataSource.getRepository(SpecGroup);
      
      // 检查规格组是否存在
      const specGroup = await specGroupRepository.findOne({
        where: { id: Number(id) }
      });
      
      if (!specGroup) {
        return errorResponse(res, 404, '规格组不存在', null);
      }
      
      // 检查名称是否重复
      if (name !== specGroup.name) {
        const existingGroup = await specGroupRepository.findOne({
          where: { name }
        });
        
        if (existingGroup) {
          return errorResponse(res, 400, '规格组名称已存在', null);
        }
      }
      
      // 更新规格组
      specGroup.name = name;
      
      const updatedGroup = await specGroupRepository.save(specGroup);
      
      return successResponse(res, updatedGroup, '更新规格组成功');
    } catch (error) {
      logger.error('更新规格组失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
  
  // 删除规格组
  async deleteGroup(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      
      const specGroupRepository = AppDataSource.getRepository(SpecGroup);
      const specItemRepository = AppDataSource.getRepository(SpecItem);
      
      // 检查规格组是否存在
      const specGroup = await specGroupRepository.findOne({
        where: { id: Number(id) }
      });
      
      if (!specGroup) {
        return errorResponse(res, 404, '规格组不存在', null);
      }
      
      // 检查是否有关联的规格项
      const itemCount = await specItemRepository.count({
        where: { groupId: Number(id) }
      });
      
      if (itemCount > 0) {
        return errorResponse(res, 400, '该规格组下有规格项，无法删除', null);
      }
      
      // 删除规格组
      await specGroupRepository.remove(specGroup);
      
      return successResponse(res, null, '删除规格组成功');
    } catch (error) {
      logger.error('删除规格组失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
  
  // 获取规格项列表
  async getItemList(req: Request, res: Response): Promise<Response> {
    try {
      const { page = 1, pageSize = 20, keyword, groupId } = req.query;
      
      // 构建查询条件
      const queryBuilder = AppDataSource.getRepository(SpecItem)
        .createQueryBuilder('specItem');
      
      // 添加筛选条件
      if (keyword) {
        queryBuilder.andWhere('specItem.value LIKE :keyword', { keyword: `%${keyword}%` });
      }
      
      if (groupId) {
        queryBuilder.andWhere('specItem.groupId = :groupId', { groupId });
      }
      
      // 计算分页
      const pageNum = Number(page);
      const pageSizeNum = Number(pageSize);
      const skip = (pageNum - 1) * pageSizeNum;
      
      // 获取总数和分页数据
      const [items, total] = await queryBuilder
        .orderBy('specItem.sort', 'DESC')
        .addOrderBy('specItem.id', 'ASC')
        .skip(skip)
        .take(pageSizeNum)
        .getManyAndCount();
      
      return successResponse(res, {
        items,
        total,
        page: pageNum,
        pageSize: pageSizeNum
      }, '获取规格项列表成功');
    } catch (error) {
      logger.error('获取规格项列表失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
  
  // 创建规格项
  async createItem(req: Request, res: Response): Promise<Response> {
    try {
      const { groupId, value, sort = 0 } = req.body;
      
      if (!groupId) {
        return errorResponse(res, 400, '规格组ID不能为空', null);
      }
      
      if (!value) {
        return errorResponse(res, 400, '规格项值不能为空', null);
      }
      
      // 检查规格组是否存在
      const specGroupRepository = AppDataSource.getRepository(SpecGroup);
      const specGroup = await specGroupRepository.findOne({
        where: { id: Number(groupId) }
      });
      
      if (!specGroup) {
        return errorResponse(res, 404, '规格组不存在', null);
      }
      
      // 检查规格项是否已存在
      const specItemRepository = AppDataSource.getRepository(SpecItem);
      const existingItem = await specItemRepository.findOne({
        where: { groupId: Number(groupId), value }
      });
      
      if (existingItem) {
        return errorResponse(res, 400, '该规格组下已存在相同值的规格项', null);
      }
      
      // 创建新规格项
      const specItem = new SpecItem();
      specItem.groupId = Number(groupId);
      specItem.value = value;
      specItem.sort = Number(sort);
      
      const savedItem = await specItemRepository.save(specItem);
      
      return successResponse(res, savedItem, '创建规格项成功');
    } catch (error) {
      logger.error('创建规格项失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
  
  // 更新规格项
  async updateItem(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { value, sort } = req.body;
      
      if (!value) {
        return errorResponse(res, 400, '规格项值不能为空', null);
      }
      
      const specItemRepository = AppDataSource.getRepository(SpecItem);
      
      // 检查规格项是否存在
      const specItem = await specItemRepository.findOne({
        where: { id: Number(id) }
      });
      
      if (!specItem) {
        return errorResponse(res, 404, '规格项不存在', null);
      }
      
      // 检查值是否重复
      if (value !== specItem.value) {
        const existingItem = await specItemRepository.findOne({
          where: { groupId: specItem.groupId, value }
        });
        
        if (existingItem) {
          return errorResponse(res, 400, '该规格组下已存在相同值的规格项', null);
        }
      }
      
      // 更新规格项
      specItem.value = value;
      if (sort !== undefined) {
        specItem.sort = Number(sort);
      }
      
      const updatedItem = await specItemRepository.save(specItem);
      
      return successResponse(res, updatedItem, '更新规格项成功');
    } catch (error) {
      logger.error('更新规格项失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
  
  // 删除规格项
  async deleteItem(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      
      const specItemRepository = AppDataSource.getRepository(SpecItem);
      
      // 检查规格项是否存在
      const specItem = await specItemRepository.findOne({
        where: { id: Number(id) }
      });
      
      if (!specItem) {
        return errorResponse(res, 404, '规格项不存在', null);
      }
      
      // 删除规格项
      await specItemRepository.remove(specItem);
      
      return successResponse(res, null, '删除规格项成功');
    } catch (error) {
      logger.error('删除规格项失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
}