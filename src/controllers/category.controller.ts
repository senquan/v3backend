import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Category } from '../models/category.model';
import { logger } from '../utils/logger';
import { errorResponse, successResponse } from '../utils/response';

export class CategoryController {
  // 获取分类列表
  async getList(req: Request, res: Response): Promise<Response> {
    try {
      const { page = 1, pageSize = 20, keyword, format = "" } = req.query;
      
      // 构建查询条件
      const queryBuilder = AppDataSource.getRepository(Category)
        .createQueryBuilder('category')
        .where('category.isDeleted = :isDeleted', { isDeleted: 0 });
      
      // 添加筛选条件
      if (keyword) {
        queryBuilder.andWhere('category.name LIKE :keyword', { keyword: `%${keyword}%` });
      }

      if (format === 'opt') {
        // 查询所有账户
        const categories = await queryBuilder.getMany();
        const options = categories.map(category => ({
          id: category.id,
          parentId: category.parentId,
          name: category.name,
        }));
        return successResponse(res, {
          categories: options
        }, '获取分类列表成功');
      } else {
        // 计算分页
        const pageNum = Number(page);
        const pageSizeNum = Number(pageSize);
        const skip = (pageNum - 1) * pageSizeNum;
        
        // 获取总数和分页数据
        const [categories, total] = await queryBuilder
          .orderBy('category.id', 'ASC')
          .skip(skip)
          .take(pageSizeNum)
          .getManyAndCount();
        
        return successResponse(res, {
          categories,
          total,
          page: pageNum,
          pageSize: pageSizeNum
        }, '获取分类列表成功');
      }
    } catch (error) {
      logger.error('获取分类列表失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
  
  // 获取所有分类（用于下拉选择）
  async getAllCategories(req: Request, res: Response): Promise<Response> {
    try {
      const categories = await AppDataSource.getRepository(Category)
        .createQueryBuilder('category')
        .orderBy('category.id', 'ASC')
        .getMany();
      
      return successResponse(res, categories, '获取所有分类成功');
    } catch (error) {
      logger.error('获取所有分类失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
  
  // 获取分类详情
  async getDetail(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      
      const category = await AppDataSource.getRepository(Category)
        .createQueryBuilder('category')
        .where('category.id = :id', { id })
        .getOne();
      
      if (!category) {
        return errorResponse(res, 404, '分类不存在', null);
      }
      
      return successResponse(res, category, '获取分类详情成功');
    } catch (error) {
      logger.error('获取分类详情失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
  
  // 创建分类
  async create(req: Request, res: Response): Promise<Response> {
    try {
      const { name, description = '' } = req.body;
      
      if (!name) {
        return errorResponse(res, 400, '分类名称不能为空', null);
      }
      
      // 检查分类名称是否已存在
      const categoryRepository = AppDataSource.getRepository(Category);
      const existingCategory = await categoryRepository.findOne({
        where: { name }
      });
      
      if (existingCategory) {
        return errorResponse(res, 400, '分类名称已存在', null);
      }
      
      // 创建新分类
      const category = new Category();
      category.name = name;
      
      const savedCategory = await categoryRepository.save(category);
      
      return successResponse(res, savedCategory, '创建分类成功');
    } catch (error) {
      logger.error('创建分类失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
  
  // 更新分类
  async update(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { name, description } = req.body;
      
      if (!name) {
        return errorResponse(res, 400, '分类名称不能为空', null);
      }
      
      const categoryRepository = AppDataSource.getRepository(Category);
      
      // 检查分类是否存在
      const category = await categoryRepository.findOne({
        where: { id: Number(id) }
      });
      
      if (!category) {
        return errorResponse(res, 404, '分类不存在', null);
      }
      
      // 检查名称是否重复
      if (name !== category.name) {
        const existingCategory = await categoryRepository.findOne({
          where: { name }
        });

        if (existingCategory) {
          return errorResponse(res, 400, '分类名称已存在', null);
        }
      }

      // 更新分类信息
      category.name = name;

      const updatedCategory = await categoryRepository.save(category);

      return successResponse(res, updatedCategory, '更新分类成功');
    } catch (error) {
      logger.error('更新分类失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 删除分类（软删除）
  async delete(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      
      const categoryRepository = AppDataSource.getRepository(Category);
      
      // 检查分类是否存在
      const category = await categoryRepository.findOne({
        where: { id: Number(id), isDeleted: 0 }
      });
      
      if (!category) {
        return errorResponse(res, 404, '分类不存在', null);
      }
      
      // 检查是否有关联的商品系列
      const seriesCount = await AppDataSource.getRepository('ProductSeries')
        .createQueryBuilder('series')
        .where('series.categoryId = :categoryId', { categoryId: Number(id) })
        .andWhere('series.isDeleted = :isDeleted', { isDeleted: 0 })
        .getCount();
      
      if (seriesCount > 0) {
        return errorResponse(res, 400, '该分类下有商品系列，无法删除', null);
      }
      
      // 软删除分类
      category.isDeleted = 1;
      await categoryRepository.save(category);
      
      return successResponse(res, null, '删除分类成功');
    } catch (error) {
      logger.error('删除分类失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
}