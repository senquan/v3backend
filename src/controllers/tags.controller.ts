import { Request, Response } from 'express';
import { In } from 'typeorm';
import { AppDataSource } from '../config/database';
import { Tag } from '../models/tag.model';
import { Product } from '../models/product.model';
import { ProductTag } from '../models/product-tag.model';
import { PlatformTags } from '../models/platform-tags.model';
import { Dict } from '../models/dict.model';
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

      //this.updatePlatformTags(tag);
      
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

      //this.updatePlatformTags(updatedTag);
      
      return successResponse(res, updatedTag, '更新标签成功');
    } catch (error) {
      logger.error('更新标签失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  async getPlatformTags(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      if (!id) {
        return errorResponse(res, 400, '平台ID不能为空', null);
      }
      const tags = await AppDataSource.getRepository(PlatformTags).find({
        where: { platformId: Number(id) },
        relations: ['tag']
      });

      return successResponse(res, {
        tags
      }, '获取标签列表成功');
    } catch (error) {
      logger.error('获取平台标签失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  async updatePlatformTags(tag: Tag) {
    try {
      // 获取所有平台信息 (group=1的dict记录)
      const platforms = await AppDataSource.getRepository(Dict).find({
        where: { group: 1 }
      });

      // 删除该标签的所有现有平台绑定关系
      await AppDataSource.getRepository(PlatformTags).delete({
        tagId: tag.id
      });

      // 检查标签名称是否包含平台名称，如果包含则创建绑定关系
      for (const platform of platforms) {
        if (tag.name.toLowerCase().includes(platform.name.toLowerCase())) {
          const platformTag = new PlatformTags();
          platformTag.platformId = Number(platform.value);
          platformTag.tagId = tag.id;
          await AppDataSource.getRepository(PlatformTags).save(platformTag);
          logger.info(`自动绑定标签 "${tag.name}" 到平台 "${platform.name}" (ID: ${platform.value})`);
        }
      }
    } catch (error) {
      logger.error('更新平台标签绑定关系失败:', error);
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

  async batchUpdateTags(req: Request, res: Response): Promise<Response> {
    try {
      const { ids, scope, adjustType, values, searchParams} = req.body;
      
      const userRoles = (req as any).userRoles || [];
      const accessTags = (req as any).accessTags || [];

      const productRepository = AppDataSource.getRepository(Product);
      // 构建查询条件
      const queryBuilder = productRepository.createQueryBuilder('product');
      if (scope === "selected") {
        if (!ids || ids.length === 0) return errorResponse(res, 400, "请提供有效的商品数据", null);
        queryBuilder.where('product.id IN (:...ids)', { ids });
      } else if (scope === "all" && searchParams) {
        queryBuilder.innerJoinAndSelect('product.modelType', 'mt');
        if (searchParams.keyword) {
          if (searchParams.keyword.length === 13 && /^[0-9]+$/.test(String(searchParams.keyword))) {
            queryBuilder.andWhere('product.barCode = :keyword', { keyword: searchParams.keyword }); 
          } else {
            queryBuilder.andWhere(
              '(product.name LIKE :keyword OR product.materialId LIKE :keyword OR mt.name LIKE :keyword)',
              { keyword: `%${searchParams.keyword}%` }
            );
          }
        }
        
        if (searchParams.color) {
          queryBuilder.andWhere('product.colorId = :color', { color: searchParams.color });
        }
  
        if (searchParams.serie) {
          queryBuilder.andWhere('product.serieId = :serie', { serie: searchParams.serie });
        }
      } else {
        return errorResponse(res, 400, "请提供有效的商品数据", null);
      }
      queryBuilder.andWhere('product.isDeleted = 0');

      if (!userRoles.includes("ADMIN")) {
        const whereClause = `(
          (NOT EXISTS (SELECT 1 FROM product_tags pt WHERE pt.product_id = product.id) 
          AND
          NOT EXISTS (SELECT 1 FROM product_series_tags pst WHERE pst.series_id = mt.serie_id))
          OR 
          ${accessTags.length > 0 ? `EXISTS (SELECT 1 FROM product_tags pt WHERE pt.product_id = product.id AND pt.tag_id IN (:...accessTags))` : 'FALSE'} 
          OR 
          ${accessTags.length > 0 ? `EXISTS (SELECT 1 FROM product_series_tags pst WHERE pst.series_id = mt.serie_id AND pst.tag_id IN (:...accessTags))` : 'FALSE'}
        )`;
        queryBuilder.andWhere(whereClause, { accessTags });
      }

      // 执行查询
      const products = await queryBuilder.getMany();

      const productTagRepository = AppDataSource.getRepository(ProductTag);
      const productIds = products.map(p => p.id);

      if (adjustType === "clear") {
        // 清除所有目标商品的标签
        if (productIds.length === 0) {
          return errorResponse(res, 400, "没有找到符合条件的商品", null);
        }
        
        await productTagRepository.delete({
          productId: In(productIds)
        });
        
        return successResponse(res, { affectedProducts: productIds.length }, '清除商品标签完成');
      } else {
        // 批量增加标签
        if (!values || values.length < 1) {
          return errorResponse(res, 400, "请提供要添加的标签", null);
        }
        
        if (productIds.length === 0) {
          return errorResponse(res, 400, "没有找到符合条件的商品", null);
        }

        // 获取每个商品现有的标签，避免重复添加
        const existingTags = await productTagRepository.find({
          where: {
            productId: In(productIds),
            tagId: In(values)
          }
        });

        // 创建现有标签的映射，用于快速查找
        const existingTagsMap = new Set(
          existingTags.map(tag => `${tag.productId}-${tag.tagId}`)
        );

        // 准备要插入的新标签关联
        const newProductTags: ProductTag[] = [];
        
        for (const productId of productIds) {
          for (const tagId of values) {
            const key = `${productId}-${tagId}`;
            // 只添加不存在的标签关联
            if (!existingTagsMap.has(key)) {
              const productTag = new ProductTag();
              productTag.productId = productId;
              productTag.tagId = tagId;
              newProductTags.push(productTag);
            }
          }
        }

        // 批量插入新的标签关联
        if (newProductTags.length > 0) {
          await productTagRepository.save(newProductTags);
        }

        return successResponse(res, {
          affectedProducts: productIds.length,
          addedTags: newProductTags.length,
          skippedDuplicates: (productIds.length * values.length) - newProductTags.length
        }, '批量添加标签完成');
      }
    } catch (error) {
      logger.error('批量更新标签失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
}