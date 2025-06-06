import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Tag } from '../models/tag.model';
import { Product } from '../models/product.model';
import { logger } from '../utils/logger';
import { errorResponse, successResponse } from '../utils/response';

export class TagsController {
  // 获取标签列表
  async getList(req: Request, res: Response): Promise<Response> {
    try {
      const { keyword, page = 1, pageSize = 20 } = req.query;
      
      // 构建查询条件
      const queryBuilder = AppDataSource.getRepository(Tag)
        .createQueryBuilder('tag')
        .where('tag.isDeleted = :isDeleted', { isDeleted: 0 });
      
      // 添加关键字搜索
      if (keyword) {
        queryBuilder.andWhere('tag.name LIKE :keyword', { keyword: `%${keyword}%` });
      }
      
      // 计算分页
      const pageNum = Number(page);
      const pageSizeNum = Number(pageSize);
      const skip = (pageNum - 1) * pageSizeNum;

      // 获取标签列表
      const [tags, total] = await queryBuilder
        .orderBy('tag.id', 'DESC')
        .skip(skip)
        .take(pageSizeNum)
        .getManyAndCount();
      
      return successResponse(res, {
        tags,
        total,
        page: pageNum,
        pageSize: pageSizeNum
      }, '获取标签列表成功');
    } catch (error) {
      logger.error('获取标签列表失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 获取标签详情
  async getDetail(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;

      // 查找标签  
      const tag = await AppDataSource.getRepository(Tag).findOne({
        where: { id: Number(id), isDeleted: 0 }  
      })
      if (!tag) {
        return errorResponse(res, 404, '标签不存在', null); 
      }

      return successResponse(res, tag, '获取标签详情成功');
    } catch (error) {
      logger.error('获取标签详情失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
  
  // 创建标签
  async create(req: Request, res: Response): Promise<Response> {
    try {
      const { name, color } = req.body;
      
      if (!name) {
        return errorResponse(res, 400, '标签名称不能为空', null);
      }
      
      // 检查标签名是否已存在
      const existingTag = await AppDataSource.getRepository(Tag).findOne({
        where: { name, isDeleted: 0 }
      });
      
      if (existingTag) {
        return errorResponse(res, 400, '标签名称已存在', null);
      }
      
      // 创建新标签
      const tag = new Tag();
      tag.name = name;
      if (color) tag.color = color;
      
      const savedTag = await AppDataSource.getRepository(Tag).save(tag);
      
      return successResponse(res, savedTag, '创建标签成功');
    } catch (error) {
      logger.error('创建标签失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
  
  // 更新标签
  async update(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { name, color } = req.body;
      
      if (!name) {
        return errorResponse(res, 400, '标签名称不能为空', null);
      }
      
      // 检查标签是否存在
      const tag = await AppDataSource.getRepository(Tag).findOne({
        where: { id: Number(id), isDeleted: 0 }
      });
      
      if (!tag) {
        return errorResponse(res, 404, '标签不存在', null);
      }
      
      // 检查新名称是否与其他标签重复
      if (name !== tag.name) {
        const existingTag = await AppDataSource.getRepository(Tag).findOne({
          where: { name, isDeleted: 0 }
        });
        
        if (existingTag) {
          return errorResponse(res, 400, '标签名称已存在', null);
        }
      }
      
      // 更新标签
      tag.name = name;
      if (color) tag.color = color;
      
      const updatedTag = await AppDataSource.getRepository(Tag).save(tag);
      
      return successResponse(res, updatedTag, '更新标签成功');
    } catch (error) {
      logger.error('更新标签失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
  
  // 删除标签（软删除）
  async delete(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      
      // 检查标签是否存在
      const tag = await AppDataSource.getRepository(Tag).findOne({
        where: { id: Number(id), isDeleted: 0 }
      });
      
      if (!tag) {
        return errorResponse(res, 404, '标签不存在', null);
      }
      
      // 软删除标签
      tag.isDeleted = 1;
      
      await AppDataSource.getRepository(Tag).save(tag);
      
      return successResponse(res, null, '删除标签成功');
    } catch (error) {
      logger.error('删除标签失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
  
  // 为商品添加标签
  async addTagToProduct(req: Request, res: Response): Promise<Response> {
    try {
      const { productId, tagId } = req.body;
      
      if (!productId || !tagId) {
        return errorResponse(res, 400, '商品ID和标签ID不能为空', null);
      }
      
      // 查找商品和标签
      const productRepository = AppDataSource.getRepository(Product);
      const tagRepository = AppDataSource.getRepository(Tag);
      
      const product = await productRepository.findOne({
        where: { id: Number(productId), isDeleted: 0 },
        relations: ['tags']
      });
      
      const tag = await tagRepository.findOne({
        where: { id: Number(tagId), isDeleted: 0 }
      });
      
      if (!product) {
        return errorResponse(res, 404, '商品不存在', null);
      }
      
      if (!tag) {
        return errorResponse(res, 404, '标签不存在', null);
      }
      
      // 检查标签是否已添加到商品
      if (!product.tags) {
        product.tags = [];
      }
      
      const tagExists = product.tags.some(t => t.id === tag.id);
      
      if (tagExists) {
        return errorResponse(res, 400, '标签已添加到该商品', null);
      }
      
      // 添加标签到商品
      product.tags.push(tag);
      await productRepository.save(product);
      
      return successResponse(res, null, '添加标签成功');
    } catch (error) {
      logger.error('为商品添加标签失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
  
  // 从商品移除标签
  async removeTagFromProduct(req: Request, res: Response): Promise<Response> {
    try {
      const { productId, tagId } = req.body;
      
      if (!productId || !tagId) {
        return errorResponse(res, 400, '商品ID和标签ID不能为空', null);
      }
      
      // 查找商品
      const productRepository = AppDataSource.getRepository(Product);
      
      const product = await productRepository.findOne({
        where: { id: Number(productId), isDeleted: 0 },
        relations: ['tags']
      });
      
      if (!product) {
        return errorResponse(res, 404, '商品不存在', null);
      }
      
      if (!product.tags || product.tags.length === 0) {
        return errorResponse(res, 400, '商品没有标签', null);
      }
      
      // 移除标签
      product.tags = product.tags.filter(tag => tag.id !== Number(tagId));
      await productRepository.save(product);
      
      return successResponse(res, null, '移除标签成功');
    } catch (error) {
      logger.error('从商品移除标签失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
  
  // 获取商品的所有标签
  async getProductTags(req: Request, res: Response): Promise<Response> {
    try {
      const { productId } = req.params;
      
      // 查找商品
      const product = await AppDataSource.getRepository(Product).findOne({
        where: { id: Number(productId), isDeleted: 0 },
        relations: ['tags']
      });
      
      if (!product) {
        return errorResponse(res, 404, '商品不存在', null);
      }
      
      // 过滤已删除的标签
      const activeTags = product.tags ? product.tags.filter(tag => tag.isDeleted === 0) : [];
      
      return successResponse(res, activeTags, '获取商品标签成功');
    } catch (error) {
      logger.error('获取商品标签失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
}