import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Dict } from '../models/dict.model';
import { PlatformTags } from '../models/platform-tags.model';
import { logger } from '../utils/logger';
import { errorResponse, successResponse } from '../utils/response';
import { Not, In } from 'typeorm';

export class DictController {
  // 获取字典列表
  async getList(req: Request, res: Response): Promise<Response> {
    try {
      const { page = 1, pageSize = 20, keyword, group } = req.query;

      // 构建查询条件
      const queryBuilder = AppDataSource.getRepository(Dict)
        .createQueryBuilder('a')
        .leftJoin(Dict, 'b', 'b.id = a.group');
      
      // 添加需要查询的字段，包括关联表的字段
      queryBuilder.select([
        'a.id', 'a.name', 'a.value', 'a.group', 'a.remark', 'a.icon', 'a.updated_at',
        'b.name AS gname', 'b.value AS gvalue'
      ]);
      
      // 添加筛选条件
      if (keyword) {
        queryBuilder.andWhere('(a.name LIKE :keyword OR a.value LIKE :keyword)', { keyword: `%${keyword}%` });
      }
      
      if (group !== undefined) {
        queryBuilder.andWhere('a.group = :group', { group });
      }
      
      // 计算分页
      const pageNum = Number(page);
      const pageSizeNum = Number(pageSize);
      const skip = (pageNum - 1) * pageSizeNum;
      
      // 获取总数和分页数据
      const total = await queryBuilder.getCount();
      const dictsRawData = await queryBuilder
        .orderBy('a.group', 'ASC')
        .addOrderBy('a.id', 'ASC')
        .skip(skip)
        .take(pageSizeNum)
        .getRawMany();

      const dicts = dictsRawData.map((item: any) => {
        return {
          id: item.a_id,
          name: item.a_name,
          value: item.a_value, 
          group: item.a_group,
          remark: item.a_remark,
          icon: item.a_icon,
          updatedAt: item.a_updated_at,
          gname: item.gname,
        } 
      })
      
      return successResponse(res, {
        dicts,
        total,
        page: pageNum,
        pageSize: pageSizeNum
      }, '获取字典列表成功');
    } catch (error) {
      logger.error('获取字典列表失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
  
  // 获取字典详情
  async getDetail(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      
      const dict = await AppDataSource.getRepository(Dict)
        .createQueryBuilder('dict')
        .where('dict.id = :id', { id })
        .getOne();
      
      if (!dict) {
        return errorResponse(res, 404, '字典不存在', null);
      }
      
      return successResponse(res, dict, '获取字典详情成功');
    } catch (error) {
      logger.error('获取字典详情失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
  
  // 根据分组获取字典
  async getByGroup(req: Request, res: Response): Promise<Response> {
    try {
      const { group } = req.params;
      
      const dicts = await AppDataSource.getRepository(Dict)
        .createQueryBuilder('dict')
        .where('dict.group = :group', { group })
        .orderBy('dict.id', 'ASC')
        .getMany();
      
      return successResponse(res, dicts, '获取分组字典成功');
    } catch (error) {
      logger.error('获取分组字典失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
  
  // 创建字典
  async create(req: Request, res: Response): Promise<Response> {
    try {
      const { name, value, icon, group, remark, tagIds } = req.body;
      
      if (!name) {
        return errorResponse(res, 400, '字典名称不能为空', null);
      }
      
      if (!value) {
        return errorResponse(res, 400, '字典值不能为空', null);
      }
      
      // 检查同一分组下是否有相同名称或值的字典
      const dictRepository = AppDataSource.getRepository(Dict);
      const existingDict = await dictRepository.findOne({
        where: [
          { name, group: Number(group) },
          { value, group: Number(group) }
        ]
      });
      
      if (existingDict) {
        return errorResponse(res, 400, '同一分组下已存在相同名称或值的字典', null);
      }
      
      // 创建新字典
      const dict = new Dict();
      dict.name = name;
      dict.value = value;
      dict.icon = icon;
      dict.group = Number(group);
      if (remark) dict.remark = remark;

      const savedDict = await dictRepository.save(dict);

      if (tagIds && Array.isArray(tagIds) && tagIds.length > 0) {
        for (const tagId of tagIds) {
          const tag = await AppDataSource.getRepository(PlatformTags).findOne({
            where: {
              platformId: Number(value),
              tagId: tagId
            }
          });
          if (!tag) {
            const platformTag = new PlatformTags();
            platformTag.platformId = Number(value);
            platformTag.tagId = tagId;
            await AppDataSource.getRepository(PlatformTags).save(platformTag);
          }
        }
      }
      
      return successResponse(res, savedDict, '创建字典成功');
    } catch (error) {
      logger.error('创建字典失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
  
  // 更新字典
  async update(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { name, value, icon, group, remark, tagIds } = req.body;
      
      if (!name) {
        return errorResponse(res, 400, '字典名称不能为空', null);
      }
      
      if (!value) {
        return errorResponse(res, 400, '字典值不能为空', null);
      }
      
      const dictRepository = AppDataSource.getRepository(Dict);
      
      // 检查字典是否存在
      const dict = await dictRepository.findOne({
        where: { id: Number(id) }
      });
      
      if (!dict) {
        return errorResponse(res, 404, '字典不存在', null);
      }
      
      // 检查同一分组下是否有相同名称或值的其他字典
      if (name !== dict.name || value !== dict.value || Number(group) !== dict.group) {
        const existingDict = await dictRepository.findOne({
          where: [
            { name, group: Number(group), id: Not(Number(id)) },
            { value, group: Number(group), id: Not(Number(id)) }
          ]
        });
        
        if (existingDict) {
          return errorResponse(res, 400, '同一分组下已存在相同名称或值的字典', null);
        }
      }
      
      // 更新字典
      dict.name = name;
      dict.value = value;
      dict.icon = icon || null;
      dict.group = Number(group);
      dict.remark = remark || null;
      
      const updatedDict = await dictRepository.save(dict);

      // 更新平台标签
      if (Number(group) === 1) {
        
        const tags = await AppDataSource.getRepository(PlatformTags).find({
          where: {
            platformId: Number(value)
          }
        });

        const oldTags = tags.map(tag => tag.tagId) || [];
        const newTags = tagIds.filter((tag: any) => typeof tag === "number");

        if (oldTags.length !== newTags.length) {

          if (JSON.stringify([...oldTags].sort()) !== JSON.stringify([...newTags].sort())) {

            const tagsToDelete = oldTags.filter((tag: any) => !newTags.includes(tag));
            if (tagsToDelete.length > 0) {
              await AppDataSource.getRepository(PlatformTags).delete({
                platformId: Number(value),
                tagId: In(tagsToDelete)
              });
            }

            // 添加新标签
            const tagsToAdd = newTags.filter((tag: any) => !oldTags.includes(tag));
            for (const tagId of tagsToAdd) {
              const tag = await AppDataSource.getRepository(PlatformTags).findOne({
                where: {
                  platformId: Number(value),
                  tagId: tagId
                }
              });
              if (!tag) {
                const platformTag = new PlatformTags();
                platformTag.platformId = Number(value);
                platformTag.tagId = tagId;
                await AppDataSource.getRepository(PlatformTags).save(platformTag);
              }
            }
          }
        }
      }
      
      return successResponse(res, updatedDict, '更新字典成功');
    } catch (error) {
      logger.error('更新字典失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
  
  // 删除字典
  async delete(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      
      const dictRepository = AppDataSource.getRepository(Dict);
      
      // 检查字典是否存在
      const dict = await dictRepository.findOne({
        where: { id: Number(id) }
      });
      
      if (!dict) {
        return errorResponse(res, 404, '字典不存在', null);
      }
      
      // 删除字典
      await dictRepository.remove(dict);
      
      return successResponse(res, null, '删除字典成功');
    } catch (error) {
      logger.error('删除字典失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
  
  // 批量删除字典
  async batchDelete(req: Request, res: Response): Promise<Response> {
    try {
      const { ids } = req.body;
      
      if (!Array.isArray(ids) || ids.length === 0) {
        return errorResponse(res, 400, '请选择要删除的字典', null);
      }
      
      const dictRepository = AppDataSource.getRepository(Dict);
      
      // 批量删除字典
      await dictRepository.delete(ids);
      
      return successResponse(res, null, '批量删除字典成功');
    } catch (error) {
      logger.error('批量删除字典失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
}