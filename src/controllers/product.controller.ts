import { Request, Response } from 'express';
import { In } from "typeorm";
import { AppDataSource } from '../config/database';
import { Product } from '../models/product.model';
import { ProductModel } from '../models/product-model.model';
import { ProductSeries } from '../models/product-series.model';
import { ProductSeriesTag } from '../models/product-series-tag.model';
import { ProductTag } from '../models/product-tag.model';
import { SpecItem } from '../models/spec-item.model';
import { Category } from '../models/category.model';
import { Tag } from '../models/tag.model';
import { logger } from '../utils/logger';
import { errorResponse, successResponse } from '../utils/response';
import { PlatformTags } from '../models/platform-tags.model';

export class ProductController {
  // 获取商品列表
  async getList(req: Request, res: Response): Promise<Response> {
    try {
      const { page = 1, pageSize = 20, mid, keyword, color, serie, status, model, limit, sort, platform, images } = req.query;
      
      const userRoles = (req as any).userRoles || [];
      let accessTags = (req as any).accessTags || [];

      if (platform) {
        const platformTagsRepository = AppDataSource.getRepository(PlatformTags);
        const platformTags = await platformTagsRepository.find({
          where: { platformId: Number(platform) }
        });
        accessTags = accessTags.filter((tagId: number) => platformTags.some(platformTag => platformTag.tagId === tagId));
      }

      // 构建查询条件
      const queryBuilder = AppDataSource.getRepository(Product)
        .createQueryBuilder('product')
        .leftJoinAndSelect('product.color', 'color')
        .leftJoinAndSelect('product.modelType', 'mt')
        .leftJoinAndSelect('product.serie', 'series')
        .leftJoinAndSelect('product.tags', 'tags')
        .where('product.isDeleted = :isDeleted', { isDeleted: 0 });
      
      // 添加标签访问控制
      // 1. 获取没有标签的商品和没有标签的系列商品（默认可访问）
      // 2. 获取用户有权限访问的标签对应的商品
      // 3. 获取用户有权限访问的系列标签对应的商品
      if (!userRoles.includes("ADMIN")) {
        const whereClause = `(
          (NOT EXISTS (SELECT 1 FROM product_tags pt WHERE pt.product_id = product.id) 
          AND
          NOT EXISTS (SELECT 1 FROM product_series_tags pst WHERE pst.series_id = product.serie_id))
          OR 
          ${accessTags.length > 0 ? `EXISTS (SELECT 1 FROM product_tags pt WHERE pt.product_id = product.id AND pt.tag_id IN (:...accessTags))` : 'FALSE'} 
          OR 
          ${accessTags.length > 0 ? `EXISTS (SELECT 1 FROM product_series_tags pst WHERE pst.series_id = product.serie_id AND pst.tag_id IN (:...accessTags))` : 'FALSE'}
        )`;
        queryBuilder.andWhere(whereClause, { accessTags });
      }

      // 添加筛选条件
      if (keyword) {
        if (keyword.length === 13 && /^[0-9]+$/.test(String(keyword))) {
          queryBuilder.andWhere('product.barCode = :keyword', { keyword }); 
        } else {
          queryBuilder.andWhere(
            '(product.name LIKE :keyword OR product.materialId LIKE :keyword OR mt.name LIKE :keyword)',
            { keyword: `%${keyword}%` }
          );
        }
      }

      if (mid) {
        queryBuilder.andWhere('mt.name LIKE :mid', { mid: `%${mid}%` });
      }
      
      if (model) {
        queryBuilder.andWhere('mt.name = :model', { model });
      }
      
      if (color) {
        queryBuilder.andWhere('product.colorId = :color', { color });
      }

      if (serie) {
        queryBuilder.andWhere('product.serieId = :serie', { serie });
      }
      
      if (status !== undefined) {
        queryBuilder.andWhere('product.status = :status', { status });
      }

      if (images) {
        if (images === '1') queryBuilder.andWhere('product.imageUrls != :imageUrls', { imageUrls: '' });
        else {
          queryBuilder.andWhere('product.imageUrls = :imageUrls', { imageUrls: '' });
        }
      }

      if (Number(limit) > 0) {
        queryBuilder.limit(Number(limit));
      }

      if (sort) {
        const order = String(sort).substring(0, 1);
        const field = String(sort).substring(1);
        if (field && order) {
          queryBuilder.orderBy(`product.${field}`, order === "+" ? "ASC" : "DESC");
        }
      }
      
      // 计算分页
      const pageNum = Number(page);
      const pageSizeNum = Number(pageSize);
      const skip = (pageNum - 1) * pageSizeNum;
      
      const total = await queryBuilder.getCount();
      // 获取总数和分页数据
      const products = await queryBuilder
        .addOrderBy('mt.sort', 'DESC')
        .addOrderBy('product.id', 'DESC')
        .skip(skip)
        .take(pageSizeNum)
        .getMany();
      let colors = [] as any[];
      if (mid || model) {
        const colorMap = new Map();
        products.forEach((product) => {
          const id = product.color?.id || "";
          if (!colorMap.has(id)) {
            colorMap.set(id, {
              id: id,
              value: product.color?.value || "",
              sort: product.color?.sort || 0
            });
          }
        });
        colors = Array.from(colorMap.values());
      } else {
        const colorsData = await AppDataSource.getRepository(SpecItem)
        .createQueryBuilder('specItem')
        .where('specItem.groupId = :group', { group: 1 })
        .orderBy('specItem.sort', 'DESC')
        .getMany();
        colors = colorsData.map((item) => ({
          id: item.id,
          value: item.value,
          sort: item.sort || 0
        }))
      }
      colors.sort((a, b) => b.sort - a.sort);

      return successResponse(res, {
        products,
        colors,
        total,
        page: pageNum,
        pageSize
      }, '获取商品列表成功');
    } catch (error) {
      logger.error('获取商品列表失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 获取商品系列列表
  async fetchSeriesList(req: Request, res: Response): Promise<Response> {
    try {
        const { 
          format = '',
          ids,
          page = 1, 
          pageSize = 20, 
          keyword,
          category,
        } = req.query;
  
        // 查询模板
        const seriesRepository = AppDataSource.getRepository(ProductSeries);
        let queryBuilder = seriesRepository.createQueryBuilder("series")
        .leftJoinAndSelect('series.category', 'category')
        .leftJoinAndSelect('series.tags','tags')
        .where('category.isDeleted = :isDeleted', { isDeleted: 0 })
        
        if (keyword) {
          queryBuilder = queryBuilder.andWhere("series.name LIKE :keyword", { keyword: `%${keyword}%` });
        }
  
        if (category) {
          queryBuilder = queryBuilder.andWhere("series.categoryId = :category", { category });
        }

        if (ids) {
          queryBuilder = queryBuilder.andWhere("series.id IN (:...ids)", { 
            ids: Array.isArray(ids) ? ids : String(ids).split(',')
          });
        }
  
        // 添加排序
        queryBuilder = queryBuilder.orderBy("series.sort", "DESC");

        // console.log(queryBuilder.getSql());
  
        // 计算总数
        const total = await queryBuilder.getCount();
        
        // 查询分页数据
        if (format === 'opt') {
          const series = await queryBuilder.getMany();
          const seriesOpt = series.map((item) => ({
            parentId: item.categoryId,
            id: item.id,
            name: item.name,
            value: item.id 
          }))

          const categoryRepository = AppDataSource.getRepository(Category);
          const categories = await categoryRepository.find({
            where: {
              isDeleted: 0
            }
          })
          const categoryOpt = categories.map((item) => ({
            parentId: 0,
            id: item.id,
            name: item.name,
            value: item.id
          }))

          return res.json({
            code: 0,
            message: '获取系列列表成功',
            data: [...categoryOpt, ...seriesOpt]
          });
        } else {
          const series = await queryBuilder
              .skip((Number(page) - 1) * Number(pageSize))
              .take(Number(pageSize))
              .getMany();
  
          return res.json({
              code: 0,
              message: '获取系列列表成功',
              data: {
                series,
                total,
                page: Number(page),
                pageSize: Number(pageSize)
              }
            });
        }
    } catch (error) {
        logger.error('获取模板列表失败:', error);
        return res.status(500).json({
            code: 500,
            message: '服务器内部错误',
            data: null
        });
    }
  }
  
  // 获取商品型号列表
  async fetchModelList(req: Request, res: Response): Promise<Response> {
    try {
        const {
          type = '',
          page = 1, 
          pageSize = 20, 
          keyword
        } = req.query;
  
        // 查询模板
        const modelRepository = AppDataSource.getRepository(ProductModel);
        let queryBuilder = modelRepository.createQueryBuilder("model")
          .where('model.isDeleted = :isDeleted', { isDeleted: 0 })
        
        if (keyword) {
          queryBuilder = queryBuilder.andWhere("model.name LIKE :keyword", { keyword: `%${keyword}%` });
        }
  
        // 添加排序
        queryBuilder = queryBuilder.orderBy("model.sort", "DESC");
  
        // 计算总数
        const total = await queryBuilder.getCount();
        
        if (type !== "all") {
          queryBuilder = queryBuilder.skip((Number(page) - 1) * Number(pageSize)).take(Number(pageSize))
        } else {
          queryBuilder = queryBuilder.select(['model.id', 'model.name'])
        }

        // 查询分页数据
        const models = await queryBuilder.getMany();

        return res.json({
          code: 0,
          message: '获取型号列表成功',
          data: {
            models,
            total,
            page: Number(page),
            pageSize: Number(pageSize)
          }
        });
    } catch (error) {
        logger.error('获取型号列表失败:', error);
        return res.status(500).json({
            code: 500,
            message: '服务器内部错误',
            data: null
        });
    }
  }

  // 获取商品详情
  async getDetail(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      
      const product = await AppDataSource.getRepository(Product)
        .createQueryBuilder('product')
        .leftJoinAndSelect('product.color', 'color')
        .leftJoinAndSelect('product.modelType','modelType')
        .leftJoinAndSelect('product.serie','serie')
        .leftJoinAndSelect('product.tags', 'tags')
        .where('product.id = :id', { id })
        .andWhere('product.isDeleted = :isDeleted', { isDeleted: 0 })
        .getOne();
      
      if (!product) {
        return errorResponse(res, 404, '商品不存在', null);
      }
      
      return successResponse(res, product, '获取商品详情成功');
    } catch (error) {
      logger.error('获取商品详情失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
  
  // 创建商品
  async create(req: Request, res: Response): Promise<Response> {
    try {
      const productData = req.body;
      const userId = (req as any).user?.id;
      // 检查物料编号是否已存在
      const productRepository = AppDataSource.getRepository(Product);
      const existingMaterialId = await productRepository.findOne(
        { where: { materialId: productData.materialId, isDeleted: 0 } }
      );
      
      if (existingMaterialId) return errorResponse(res, 400, '物料已存在', null);

      // 处理颜色关联
      if (productData.colorId) {
        const specItemRepository = AppDataSource.getRepository(SpecItem);
        const color = await specItemRepository.findOne({ 
          where: { id: Number(productData.colorId) } 
        });
        if (!color) {
          return errorResponse(res, 400, '指定的颜色不存在', null);
        }
        productData.color = color;
      } else {
        productData.colorId = null;
      }

      // 检查型号是否为字符串
      const modelTypeRepository = AppDataSource.getRepository(ProductModel);
      if (typeof productData.modelType === 'string') {
        // 检查型号是否已存在
        const existingModelType = await modelTypeRepository.findOne({
          where: { name: productData.modelType, isDeleted: 0 }
        });
        if (existingModelType) {
          productData.modelType = existingModelType;
        } else {
          // 创建新型号
          const newModelType = new ProductModel();
          newModelType.name = productData.modelType;
          const savedModelType = await modelTypeRepository.save(newModelType);
          productData.modelType = savedModelType;
        }
      } else if (Number(productData.modelType > 0)) {
        const modelType = await modelTypeRepository.findOne({
          where: { id: productData.modelType }
        });
        if (!modelType) {
          return errorResponse(res, 400, '指定的型号不存在', null);
        }
        productData.modelType = modelType;
      } else {
        productData.modelType = null;
      }

      const seriesRepository = AppDataSource.getRepository(ProductSeries);
      if (Number(productData.serie) > 0) {
        const serie = await seriesRepository.findOne({
          where: { id: productData.serie }
        });
        if (!serie) {
          return errorResponse(res, 400, '指定的系列不存在', null);
        }
        productData.serie = serie;
      } else {
        const defaultSeries = await seriesRepository.createQueryBuilder('series')
          .where('series.id = :id', { id: 1 })
          .getOne();
        productData.serie = defaultSeries;
      }

      if (Array.isArray(productData.imageFiles) && productData.imageFiles.length > 0) {
        productData.imageUrls = productData.imageFiles.join(',');
      }
      
      // 创建新商品
      const product = new Product();
      Object.assign(product, {
        ...productData,
        sku: "PROD" + productData.materialId,
        createAt: new Date(),
        updateAt: new Date(),
        isDeleted: 0
      });
      
      const savedProduct = await productRepository.save(product);
      
      // 处理标签关联
      if (Array.isArray(productData.tags) && productData.tags.length > 0) {
        // 验证标签是否存在
        const tagRepository = AppDataSource.getRepository(Tag);
        const tagEntities = await tagRepository.find({
          where: { id: In(productData.tags) },
        });
        
        // 创建标签关联
        const tagRelations = tagEntities.map(tag => ({
          productId: savedProduct.id,
          tagId: tag.id
        }));
        
        const productTagRepository = AppDataSource.getRepository(ProductTag);
        await productTagRepository.insert(tagRelations);

        savedProduct.tags = tagEntities;
      }

      return successResponse(res, savedProduct, '创建商品成功');
    } catch (error) {
      logger.error('创建商品失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
  
  // 更新商品
  async update(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const productData = req.body;
    const userId = (req as any).user?.id;

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 检查商品是否存在
      const product = await queryRunner.manager.findOne(Product, {
        where: { id: Number(id), isDeleted: 0 },
        relations: ["color", "modelType", "serie", "tags"]
      });
      if (!product) throw new Error("商品不存在");
      
      if (productData.materialId && productData.materialId !== product.materialId) {
        const existingSku = await queryRunner.manager.findOne(Product, { where: { sku: productData.materialId, isDeleted: 0 } });
        if (existingSku) throw new Error("物料已存在");
      }

      if (productData.colorId && productData.colorId !== product.colorId) {
        const colorId = Number(productData.colorId);
        if (colorId) {
          const color = await queryRunner.manager.findOne(SpecItem, { where: { id: colorId } });
          if (color) product.color = color;
        } else {
          product.color = null;
        }
      }

      // 检查型号是否更新
      const modelTypeRepository = AppDataSource.getRepository(ProductModel);
      if (typeof productData.modelType === 'string') {
        // 检查型号是否已存在
        const existingModelType = await modelTypeRepository.findOne({
          where: { name: productData.modelType }
        });
        if (existingModelType) {
          if (existingModelType.isDeleted === 1) {
            existingModelType.isDeleted = 0;
            await modelTypeRepository.save(existingModelType);
          }
          productData.modelType = existingModelType;
        } else {
          // 创建新型号
          const newModelType = new ProductModel();
          newModelType.name = productData.modelType;
          const savedModelType = await modelTypeRepository.save(newModelType);
          productData.modelType = savedModelType;
        }
      } else if (Number(productData.modelType > 0)) {
        const modelType = await modelTypeRepository.findOne({
          where: { id: productData.modelType }
        });
        if (!modelType) {
          return errorResponse(res, 400, '指定的型号不存在', null);
        }
        productData.modelType = modelType;
      } else {
        productData.modelType = null;
      }

      const serieId = Number(productData.serie);
      if (serieId !== product.serieId) {
        if (serieId > 0) {
          const serie = await queryRunner.manager.findOne(ProductSeries, {
            where: { id: serieId, isDeleted: 0 }
          });
          if (!serie) {
            throw new Error("指定的系列不存在");
          }
          product.serie = serie;
        } else {
          const defaultSeries = await queryRunner.manager.findOne(ProductSeries, {
            where: { id: 1 }
          });
          product.serie = defaultSeries;
        }
      }

      // 检查图片文件列表是否有变化
      const oldFiles = product.imageUrls ? product.imageUrls.split(',') : [];
      const newFiles = productData.imageFiles ? productData.imageFiles : [];

      if (JSON.stringify(oldFiles.sort()) !== JSON.stringify(newFiles.sort())) {
        product.imageUrls = productData.imageFiles.join(',');
      }

      // 处理标签关联
      const oldTags = product.tags?.map(tag => tag.id) || [];
      const newTags = productData.tags.filter((tag: any) => typeof tag === "number");

      // 只有当标签发生变化时才更新
      if (JSON.stringify([...oldTags].sort()) !== JSON.stringify([...newTags].sort())) {
        const tagEntities = await queryRunner.manager.findBy(Tag, {
          id: In(newTags)
        });
        
        product.tags = tagEntities;
        
        // 删除旧的关联关系
        await queryRunner.manager.delete(ProductTag, { 
          productId: product.id
        });
        
        // 创建新的关联关系
        const tagRelations = newTags.map((tagId: number) => ({
          productId: product.id,
          tagId
        }));
        
        await queryRunner.manager.insert(ProductTag, tagRelations);
        delete productData.tags;
      }
      const { modelType, serie, ...updateData } = productData;
      Object.assign(product, {
        ...updateData,
        updateAt: new Date()
      })
      const updatedProduct = await queryRunner.manager.save(product);
      await queryRunner.commitTransaction();
      return successResponse(res, updatedProduct, '更新商品成功');
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      logger.error('更新商品失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    } finally {
      await queryRunner.release();
    }
  }
  
  // 删除商品（软删除）
  async delete(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      
      const productRepository = AppDataSource.getRepository(Product);
      // 检查商品是否存在
      const product = await productRepository.findOne({
        where: { id: Number(id), isDeleted: 0 }
      });
      
      if (!product) return errorResponse(res, 404, '商品不存在', null);
      
      await productRepository.update(id, {
        isDeleted: 1,
        updateAt: new Date()
      });
      return successResponse(res, null, '删除商品成功');
    } catch (error) {
      logger.error('删除商品失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 批量导入商品
  async importProducts(req: Request, res: Response): Promise<Response> {
    try {
      const products = req.body.products;
      
      if (!Array.isArray(products) || products.length === 0) {
        return errorResponse(res, 400, "请提供有效的商品数据", null);
      }
      
      const productRepository = AppDataSource.getRepository(Product);
      const specItemRepository = AppDataSource.getRepository(SpecItem);
      const seriesRepository = AppDataSource.getRepository(ProductSeries);
      const modelTypeRepository = AppDataSource.getRepository(ProductModel);

      const DEFAULT_COLOR_GROUP_ID = 1;
      const DEFAULT_SERIES_CATEGORY_ID = 1;

      // 缓存所有的颜色和系列
      const colors = await specItemRepository.find({ where: { groupId: DEFAULT_COLOR_GROUP_ID } });
      const series = await seriesRepository.find();
      const modelTypes = await modelTypeRepository.find();

      const colorMap = new Map(colors.map(color => [color.value, color]));
      const seriesMap = new Map(series.map(serie => [serie.name, serie]));
      const modelTypeMap = new Map(modelTypes.map(modelType => [modelType.name, modelType]));
      
      const results = {
        success: 0,
        ignored: 0,
        updated: 0,
        error: 0,
        errorMessages: [] as string[]
      };
      
      // 批量处理商品数据
      for (const productData of products) {
        try {
          // 验证必填字段
          if (!productData.materialId) {
            results.error++;
            results.errorMessages.push(`物料编号缺失，跳过该商品`);
            continue;
          }

          if (!/^[a-zA-Z0-9]+$/.test(productData.materialId)) {
            results.error++;
            results.errorMessages.push(`物料编号 ${productData.materialId} 格式不正确，只能包含数字和字母，跳过该商品`);
            continue;
          }
          
          // 检查物料编号是否已存在
          const existingProduct = await productRepository.findOne({
            where: { materialId: productData.materialId },
            relations: ["color", "modelType", "serie"]
          });
          
          if (existingProduct) {
            let isUpdated = false;

            // 检查并更新颜色
            if (productData.color !== undefined && productData.color !== existingProduct.color?.value) {
              const color = colorMap.get(productData.color);
              if (!color) {
                const color = new SpecItem();
                color.value = productData.color;
                color.groupId = 1;
                color.sort = 0;
  
                await specItemRepository.save(color);
                colorMap.set(productData.color, color);
              }
              existingProduct.color = colorMap.get(productData.color)!;
              isUpdated = true;
            }

            // 检查并更新型号
            if (productData.modelType !== undefined && productData.modelType !== existingProduct.modelType?.name) {
              const modelType = modelTypeMap.get(productData.modelType);
              if (!modelType) {
                const modelType = new ProductModel();
                modelType.name = productData.modelType;
                await modelTypeRepository.save(modelType);
                modelTypeMap.set(productData.modelType, modelType);
              }
              existingProduct.modelType = modelTypeMap.get(productData.modelType)!;
              isUpdated = true;
            }

            // 检查并更新系列
            if (productData.serie !== undefined && productData.serie !== existingProduct.serie?.name) {
              if (productData.serie === "") productData.serie = "其他";
              const serie = seriesMap.get(productData.serie);
              if (!serie) {
                const serie = new ProductSeries();
                serie.name = productData.serie;
                serie.categoryId = DEFAULT_SERIES_CATEGORY_ID;
                await seriesRepository.save(serie);
                seriesMap.set(productData.serie, serie);
              }
              existingProduct.serie = seriesMap.get(productData.serie)!;
              isUpdated = true;
            }

            // 检查并更新名称
            if (productData.name !== undefined && productData.name !== existingProduct.name) {
              existingProduct.name = productData.name;
              isUpdated = true;
            }

            // 检查并更新条码
            if (productData.barCode !== undefined && String(productData.barCode) !== existingProduct.barCode) {
              existingProduct.barCode = String(productData.barCode);
              isUpdated = true;
            }

            // 检查并更新备注
            if (productData.remark !== undefined && productData.remark !== existingProduct.remark) {
              existingProduct.remark = productData.remark;
              isUpdated = true;
            }

            // 检查并更新基础价格
            if (productData.basePrice !== undefined && productData.basePrice !== Number(existingProduct.basePrice)) {
              existingProduct.basePrice = productData.basePrice;
              isUpdated = true;
            }
            
            // 检查并更新工程价格
            if (productData.projectPrice !== undefined && productData.projectPrice!== Number(existingProduct.projectPrice)) {
              existingProduct.projectPrice = productData.projectPrice;
              isUpdated = true;
            }
            
            // 检查并更新出厂价格
            if (productData.factoryPrice !== undefined && productData.factoryPrice!== Number(existingProduct.factoryPrice)) {
              existingProduct.factoryPrice = productData.factoryPrice;
              isUpdated = true;
            }

            // 是否已删除
            if (Number(existingProduct.isDeleted) === 1) {
              isUpdated = true;
            }
            
            if (isUpdated) {
              existingProduct.updateAt = new Date();
              existingProduct.isDeleted = 0;
              await productRepository.save(existingProduct);
              results.updated++;
              results.errorMessages.push(`物料编号 ${productData.materialId} 信息已更新`);
            } else {
              results.ignored++;
              results.errorMessages.push(`物料编号 ${productData.materialId} 已存在，且信息无变更，跳过该商品`);
            }
            continue;
          }
          
          // 创建新商品
          const product = new Product();
          
          // 设置基本属性
          product.materialId = productData.materialId;
          product.name = productData.name || `商品${productData.materialId}`;
          product.barCode = productData.barCode || "";
          product.basePrice = productData.basePrice || 0;
          product.projectPrice = productData.projectPrice || 0;
          product.factoryPrice = productData.factoryPrice || 0;
          product.remark = productData.remark || "";
          product.sku = "PROD" + productData.materialId;
          product.status = 1; // 默认启用
          product.isDeleted = 0;
          product.createAt = new Date();
          product.updateAt = new Date();
          
          // 处理颜色关联
          if (productData.color) {
            if (!colorMap.has(productData.color)) {
              const color = new SpecItem();
              color.value = productData.color;
              color.groupId = 1;
              color.sort = 0;

              await specItemRepository.save(color);
              colorMap.set(productData.color, color);
            }
            product.color = colorMap.get(productData.color)!;
          }

          // 处理型号关联
          if (productData.modelType) {
            if (!modelTypeMap.has(productData.modelType)) {
              const modelType = new ProductModel();
              modelType.name = productData.modelType;
              await modelTypeRepository.save(modelType);
              modelTypeMap.set(productData.modelType, modelType);
            }
            product.modelType = modelTypeMap.get(productData.modelType)!;
          }
          if (!productData.serie) productData.serie = "其他";
          if (productData.serie) {
            if (!seriesMap.has(productData.serie)) {
              const serie = new ProductSeries();
              serie.name = productData.serie;
              serie.categoryId = DEFAULT_SERIES_CATEGORY_ID;
              await seriesRepository.save(serie);
              seriesMap.set(productData.serie, serie);
            }
            product.serie = seriesMap.get(productData.serie)!;
          }
          // 保存商品
          await productRepository.save(product);
          results.success++;
        } catch (error) {
          results.error++;
          const errorMessage = error instanceof Error ? error.message : "未知错误";
          results.errorMessages.push(`处理物料编号 ${productData.materialId} 时出错: ${errorMessage}`);
          logger.error(`导入商品失败 [${productData.materialId}]:`, error);
        }
      }
      
      return successResponse(res, results, `批量导入完成，成功: ${results.success}，失败: ${results.error}`);
    } catch (error) {
      logger.error("批量导入商品失败:", error);
      return errorResponse(res, 500, "服务器内部错误", null);
    }
  }

  // 批量更新商品价格
  async batchUpdatePrices(req: Request, res: Response): Promise<Response> {
    try {
      const { ids, adjustType, values, searchParams} = req.body;
      
      if (!searchParams && (!ids || ids.length === 0) ) {
        return errorResponse(res, 400, "请提供有效的商品数据", null);
      }

      if (values.length < 1) {
        return errorResponse(res, 400, "设置值数据不全", null);
      }

      const userRoles = (req as any).userRoles || [];
      const accessTags = (req as any).accessTags || [];
      
      const productRepository = AppDataSource.getRepository(Product);
      
      // 构建查询条件
      const queryBuilder = productRepository.createQueryBuilder('product');

      if (ids && ids.length > 0) {
        queryBuilder.where('product.id IN (:...ids)', { ids });
      } else if (searchParams) {
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
          queryBuilder.andWhere('mt.serieId = :serie', { serie: searchParams.serie });
        }
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

      // 构建更新数据
      products.forEach((product) => {
        const basePrice = Number(product.basePrice);
        const projectPrice = Number(product.projectPrice);
        const factoryPrice = Number(product.factoryPrice);
        const price = {
          basePrice: basePrice,
          projectPrice: projectPrice,
          factoryPrice: factoryPrice
        }
        if (adjustType === "percent") {
          if (values[0] !== 0) {
            price.basePrice = basePrice * (1 + values[0] / 100);
          }
          if (values[1] && values[1] !== 0) {
            price.projectPrice = projectPrice * (1 + values[1] / 100);
          }
          if (values[2] && values[2] !== 0) {
            price.factoryPrice = factoryPrice * (1 + values[2] / 100);
          }
        } else if (adjustType === "fixed") {
          if (values[0]!== 0) {
            price.basePrice = values[0];
          }
          if (values[1] && values[1] !== 0) {
            price.projectPrice = values[1];
          }
          if (values[2] && values[2] !== 0) {
            price.factoryPrice = values[2];
          }
        }
        productRepository.update(product.id, {
          ...price,
          updateAt: new Date()
        })
      })      
      return successResponse(res, null, '批量更新价格完成');
    } catch (error) {
      logger.error('批量更新价格失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
  
  // 批量删除商品
  async batchDeleteProducts(req: Request, res: Response): Promise<Response> {
    try {
      const { ids } = req.body;
      
      if (!Array.isArray(ids) || ids.length === 0) {
        return errorResponse(res, 400, '请选择要删除的商品', null);
      }
      
      // 批量软删除
      await AppDataSource.getRepository(Product)
        .createQueryBuilder()
        .update(Product)
        .set({ isDeleted: 1, updateAt: new Date() })
        .whereInIds(ids)
        .andWhere('isDeleted = :isDeleted', { isDeleted: 0 })
        .execute();
      
      return successResponse(res, null, '批量删除商品成功');
    } catch (error) {
      logger.error('批量删除商品失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  async createSeries(req: Request, res: Response): Promise<Response> {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    
    try {
      const { name, categoryId, sort = 0, tags = [] } = req.body;
      
      // 验证必填字段
      if (!name || !categoryId) {
        throw new Error('名称和分类为必填项');
      }
      
      // 检查分类是否存在
      const category = await queryRunner.manager.findOne(Category, {
        where: { id: categoryId, isDeleted: 0 }
      });
      
      if (!category) {
        throw new Error('指定的分类不存在');
      }
      
      // 检查名称是否重复
      const existingSeries = await queryRunner.manager.findOne(ProductSeries, {
        where: { 
          name,
          categoryId,
          isDeleted: 0
        }
      });
      
      if (existingSeries) {
        throw new Error('该分类下已存在同名系列');
      }
      
      // 创建新系列
      const series = new ProductSeries();
      series.name = name;
      series.categoryId = categoryId;
      series.sort = Number(sort);
      series.isDeleted = 0;
      
      // 保存系列
      const savedSeries = await queryRunner.manager.save(ProductSeries, series);
      
      // 处理标签关联
      if (Array.isArray(tags) && tags.length > 0) {
        // 验证标签是否存在
        const tagEntities = await queryRunner.manager.findBy(Tag, {
          id: In(tags.filter(tag => typeof tag === 'number'))
        });
        
        if (tagEntities.length !== tags.length) {
          throw new Error('部分标签不存在');
        }
        
        // 创建标签关联
        const tagRelations = tagEntities.map(tag => ({
          seriesId: savedSeries.id,
          tagId: tag.id
        }));
        
        await queryRunner.manager.insert(ProductSeriesTag, tagRelations);
        
        // 更新series的tags关系
        savedSeries.tags = tagEntities;
      }
      
      // 提交事务
      await queryRunner.commitTransaction();
      
      return successResponse(res, savedSeries, '创建系列成功');
    } catch (error: any) {
      // 回滚事务
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      
      logger.error('创建系列失败:', error);
      return errorResponse(res, 500, `创建系列失败：${error.message}`, null);
    } finally {
      // 释放查询运行器
      await queryRunner.release();
    }
  }

  async updateSeries(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const { name, categoryId, sort, tags } = req.body;
    
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 检查系列是否存在
      const series = await queryRunner.manager.findOne(ProductSeries, {
        where: { id: Number(id) },
        relations: ['tags']
      });
      if (!series) {
        throw new Error('系列不存在');
      }
      
      // 检查名称是否重复
      if (name && name !== series.name) {
        const existingSeries = await queryRunner.manager.findOne(ProductSeries, {
          where: { 
            name,
            categoryId: categoryId || series.categoryId 
          }
        })
        
        if (existingSeries) {
          throw new Error('该分类下已存在同名系列')
        }
      }

      // 查找分类
      const categoryRepository = AppDataSource.getRepository(Category)
      const category = await categoryRepository.findOne({
        where: { id: categoryId }
      });
      
      if (!category) throw new Error('分类不存在')
      series.category = category;

      // 更新标签
      const oldTags = series.tags?.map(tag => tag.id) || []
      const newTags = tags.filter((tag: any) => typeof tag === "number")
   
      // 只有当标签发生变化时才更新
      if (JSON.stringify([...oldTags].sort()) !== JSON.stringify([...newTags].sort())) {
        const tagEntities = await queryRunner.manager.findBy(Tag, {
          id: In(newTags)
        })
        
        series.tags = tagEntities
        
        // 删除旧的关联关系
        await queryRunner.manager.delete(ProductSeriesTag, { 
          seriesId: series.id
        })
        
        // 创建新的关联关系
        const tagRelations = newTags.map((tagId: number) => ({
          seriesId: series.id,
          tagId
        }))
        
        await queryRunner.manager.insert(ProductSeriesTag, tagRelations)
      }
      
      // 更新系列基本信息
      if (name) series.name = name;
      if (sort !== undefined) series.sort = Number(sort);
      
      // 保存更新
      const updatedSeries = await queryRunner.manager.save(ProductSeries, series);
      
      // 提交事务
      await queryRunner.commitTransaction();
      return successResponse(res, updatedSeries, '更新系列成功');
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      logger.error('更新系列失败:', error);
      return errorResponse(res, 500, `更新系列失败：${error}`, null);
    } finally {
      await queryRunner.release();
    }
  }

  async deleteSeries(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      
      const seriesRepository = AppDataSource.getRepository(ProductSeries);
      const productRepository = AppDataSource.getRepository(Product);
      
      // 检查系列是否存在
      const series = await seriesRepository.findOne({
        where: { id: Number(id) }
      });
      
      if (!series) {
        return errorResponse(res, 404, '系列不存在', null);
      }
      
      // 检查是否有关联商品
      const productCount = await productRepository.count({
        where: { serieId: Number(id) }
      });
      
      if (productCount > 0) {
        return errorResponse(res, 400, '该系列下存在关联商品，无法删除', null);
      }
      
      // 删除系列
      await seriesRepository.remove(series);
      
      return successResponse(res, null, '删除系列成功');
    } catch (error) {
      logger.error('删除系列失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  async createModel(req: Request, res: Response): Promise<Response> {
    try {
      const modelData = req.body;
      
      // 验证必填字段
      if (!modelData.name) {
        return errorResponse(res, 400, '型号名称不能为空', null);
      }

      const modelRepository = AppDataSource.getRepository(ProductModel);
      
      // 检查型号名称是否已存在
      const existingModel = await modelRepository.findOne({
        where: { name: modelData.name, isDeleted: 0 }
      });
      
      if (existingModel) {
        return errorResponse(res, 400, '型号名称已存在', null);
      }
      
      // 创建新型号
      const model = new ProductModel();
      Object.assign(model, {
        ...modelData,
        isDeleted: 0
      });
      
      const savedModel = await modelRepository.save(model);
      return successResponse(res, savedModel, '创建型号成功');
    } catch (error) {
      logger.error('创建型号失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 更新型号
  async updateModel(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const modelData = req.body;
      modelData.value = Number(modelData.value);

      const modelRepository = AppDataSource.getRepository(ProductModel);
      
      // 检查型号是否存在
      const model = await modelRepository.findOne({
        where: { id: Number(id), isDeleted: 0 }
      });
      
      if (!model) {
        return errorResponse(res, 404, '型号不存在', null);
      }
      
      // 如果更新了名称，检查新名称是否已存在
      if (modelData.name && modelData.name !== model.name) {
        const existingModel = await modelRepository.findOne({
          where: { name: modelData.name, isDeleted: 0 }
        });
        
        if (existingModel) {
          return errorResponse(res, 400, '型号名称已存在', null);
        }
      }
      
      // 更新型号信息
      Object.assign(model, modelData);
      
      const updatedModel = await modelRepository.save(model);
      return successResponse(res, updatedModel, '更新型号成功');
    } catch (error) {
      logger.error('更新型号失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 删除型号（软删除）
  async deleteModel(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      
      const modelRepository = AppDataSource.getRepository(ProductModel);
      
      // 检查型号是否存在
      const model = await modelRepository.findOne({
        where: { id: Number(id), isDeleted: 0 }
      });
      
      if (!model) {
        return errorResponse(res, 404, '型号不存在', null);
      }
      
      // 软删除型号
      model.isDeleted = 1;
      
      await modelRepository.save(model);
      return successResponse(res, null, '删除型号成功');
    } catch (error) {
      logger.error('删除型号失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  async exitTransaction(queryRunner: any) {
    try {
      // 检查事务是否活跃
      if (queryRunner && queryRunner.isTransactionActive) {
        // 回滚事务
        await queryRunner.rollbackTransaction();
      }
    } catch (error) {
      logger.error('回滚事务失败:', error);
    } finally {
      // 释放查询运行器资源
      if (queryRunner) {
        await queryRunner.release();
      }
      logger.error('回滚事务成功!');
    }
  }
}
