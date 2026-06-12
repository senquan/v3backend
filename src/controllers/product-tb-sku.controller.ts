import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { ProductTbSku } from '../models/product-tb-sku.model';
import { Product } from '../models/product.model';
import { Dict } from '../models/dict.model';
import { logger } from '../utils/logger';
import { errorResponse, successResponse } from '../utils/response';

export class ProductTbSkuController {
  // 创建SKU
  async create(req: Request, res: Response): Promise<Response> {
    try {
      const { platformId, productId, materialCode, tbItemId, tbSkuId } = req.body;

      // 验证必要字段
      if (!productId) {
        return errorResponse(res, 400, '商品不能为空', null);
      }
      if (!materialCode) {
        return errorResponse(res, 400, '物料号不能为空', null);
      }
      if (!tbItemId) {
        return errorResponse(res, 400, '宝贝ID不能为空', null);
      }
      if (!tbSkuId) {
        return errorResponse(res, 400, 'SKUID不能为空', null);
      }

      // 验证商品是否存在
      const product = await AppDataSource.getRepository(Product).findOne({
        where: { id: Number(productId), isDeleted: 0 }
      });
      if (!product) {
        return errorResponse(res, 400, '商品不存在', null);
      }

      // 检查唯一性
      const existingSku = await AppDataSource.getRepository(ProductTbSku).findOne({
        where: { tbSkuId, tbItemId }
      });
      if (existingSku) {
        return errorResponse(res, 400, '该SKUID已存在', null);
      }

      // 创建SKU
      const sku = new ProductTbSku();
      sku.platformId = platformId || 0;
      sku.productId = Number(productId);
      sku.materialCode = materialCode;
      sku.tbItemId = tbItemId;
      sku.tbSkuId = tbSkuId;

      const savedSku = await AppDataSource.getRepository(ProductTbSku).save(sku);

      return successResponse(res, savedSku, '创建SKU成功');
    } catch (error) {
      logger.error('创建SKU失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 获取SKU列表
  async getList(req: Request, res: Response): Promise<Response> {
    try {
      const { page = 1, pageSize = 20, keyword, platformId, serie } = req.query;

      const queryBuilder = AppDataSource.getRepository(ProductTbSku)
        .createQueryBuilder('sku')
        .leftJoinAndSelect('sku.product', 'product')
        .leftJoinAndSelect('product.serie', 'series')
        .leftJoinAndSelect('product.color', 'color');

      // 按平台过滤
      if (platformId) {
        queryBuilder.andWhere('sku.platformId = :platformId', { platformId: Number(platformId) });
      }

      // 关键字搜索
      if (keyword) {
        queryBuilder.andWhere(
          '(sku.materialCode LIKE :keyword OR sku.tbItemId LIKE :keyword OR sku.tbSkuId LIKE :keyword OR product.name LIKE :keyword)',
          { keyword: `%${keyword}%` }
        );
      }

      if (serie) {
        queryBuilder.andWhere('series.id = :serie', { serie: Number(serie) });
      }

      const pageNum = Number(page);
      const pageSizeNum = Number(pageSize);

      const [skus, total] = await queryBuilder
        .orderBy('sku.createdAt', 'DESC')
        .skip((pageNum - 1) * pageSizeNum)
        .take(pageSizeNum)
        .getManyAndCount();

      // 获取所有平台字典
      const platforms = await AppDataSource.getRepository(Dict).find({
        where: { group: 1 }
      });
      const platformMap: Record<number, string> = {};
      platforms.forEach(p => {
        platformMap[Number(p.id)] = p.name;
      });

      // 组装返回数据
      const list = skus.map(sku => ({
        id: sku.id,
        platformId: sku.platformId,
        platformName: platformMap[sku.platformId] || '',
        productId: sku.productId,
        productName: sku.product?.name || '',
        serieName: sku.product?.serie?.name || '',
        specName: sku.product?.color?.value || '',
        materialCode: sku.materialCode,
        tbItemId: sku.tbItemId,
        tbSkuId: sku.tbSkuId,
        createdAt: sku.createdAt
      }));

      return successResponse(res, {
        skus: list,
        total,
        page: pageNum,
        pageSize: pageSizeNum
      }, '获取SKU列表成功');
    } catch (error) {
      logger.error('获取SKU列表失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 获取SKU详情
  async getDetail(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;

      const sku = await AppDataSource.getRepository(ProductTbSku)
        .createQueryBuilder('sku')
        .leftJoinAndSelect('sku.product', 'product')
        .leftJoinAndSelect('product.serie', 'series')
        .leftJoinAndSelect('product.color', 'color')
        .where('sku.id = :id', { id: Number(id) })
        .getOne();

      if (!sku) {
        return errorResponse(res, 404, 'SKU不存在', null);
      }

      return successResponse(res, sku, '获取SKU详情成功');
    } catch (error) {
      logger.error('获取SKU详情失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 更新SKU
  async update(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { platformId, productId, materialCode, tbItemId, tbSkuId } = req.body;

      const sku = await AppDataSource.getRepository(ProductTbSku).findOne({
        where: { id: Number(id) }
      });

      if (!sku) {
        return errorResponse(res, 404, 'SKU不存在', null);
      }

      // 验证商品是否存在
      if (productId) {
        const product = await AppDataSource.getRepository(Product).findOne({
          where: { id: Number(productId), isDeleted: 0 }
        });
        if (!product) {
          return errorResponse(res, 400, '商品不存在', null);
        }
      }

      // 检查唯一性
      if (tbSkuId && tbSkuId !== sku.tbSkuId) {
        const existingSku = await AppDataSource.getRepository(ProductTbSku).findOne({
          where: { tbSkuId, tbItemId: tbItemId || sku.tbItemId }
        });
        if (existingSku) {
          return errorResponse(res, 400, '该SKUID已存在', null);
        }
      }

      if (platformId !== undefined) sku.platformId = platformId;
      if (productId) sku.productId = Number(productId);
      if (materialCode) sku.materialCode = materialCode;
      if (tbItemId) sku.tbItemId = tbItemId;
      if (tbSkuId) sku.tbSkuId = tbSkuId;

      const updatedSku = await AppDataSource.getRepository(ProductTbSku).save(sku);

      return successResponse(res, updatedSku, '更新SKU成功');
    } catch (error) {
      logger.error('更新SKU失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 删除SKU（硬删除）
  async delete(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;

      const result = await AppDataSource.getRepository(ProductTbSku).delete(Number(id));

      if (result.affected === 0) {
        return errorResponse(res, 404, 'SKU不存在', null);
      }

      return successResponse(res, null, '删除SKU成功');
    } catch (error) {
      logger.error('删除SKU失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
}
