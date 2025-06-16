import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Order } from '../models/order.model';
import { OrderItem } from '../models/order-item.model';
import { Promotion } from '../models/promotion.model';
import { PromotionRule } from '../models/promotion-rule.model';
import { OrderStatusLogService } from '../services/order-status-log.service';
import { logger } from '../utils/logger';
import { errorResponse, successResponse } from '../utils/response';
import { Dict } from '../models/dict.model';
import { Product } from '../models/product.model';
import { OrderCalculationLog } from '../models/order-calculation-log.model';

interface ProductWithQuantity {
  product: Product;
  quantity: number;
  unitPrice: number;
}

interface DiscountMatchLog {
  productId: number;
  ruleId: number;
  name: string;
  value: number;
  pirce: number;
  stepPrice: number;
}

export class OrderController {

  constructor(
    private readonly orderStatusLogService: OrderStatusLogService = new OrderStatusLogService(),
  ) {}

  async create(req: Request, res: Response): Promise<Response> {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const userId = (req as any).user.id;
    try {
      // 修改请求参数解析
      const { name, type, platformId, originPrice, flashPrice, dailyPrice, promotionPrice, products, remark, matchLogs } = req.body;

      // 验证必要字段
      if (!name || !platformId || !products?.length) {
        return errorResponse(res, 400, '缺少必要参数', null);
      }

      // 生成订单信息
      const order = new Order();
      order.name = name;
      order.platformId = platformId;
      order.customerId = 0;
      order.userId = userId;
      order.remark = remark;

      // 计算价格和数量
      let totalQuantity = 0;
      const orderItems = products.map((item: any) => {
        const itemTotal = item.unitPrice * item.quantity;
        totalQuantity += item.quantity;

        const orderItem = new OrderItem();
        orderItem.productId = item.id;
        orderItem.unitPrice = item.unitPrice;
        orderItem.quantity = item.quantity;
        orderItem.totalPrice = itemTotal;
        return orderItem;
      });

      // 设置订单金额（假设原价和支付价格相同）
      order.authCode = 'DEFAULT_AUTH_CODE';
      order.quantity = totalQuantity;
      order.originPrice = originPrice;
      order.payPrice = flashPrice; 
      order.status = Number(type) > 0 ? 0 : -1;   // 0 发布，-1 草稿
      order.payStatus = 0; // 未支付

      // 保存订单
      const savedOrder = await queryRunner.manager.save(order);
      
      // 设置订单项的orderId
      orderItems.forEach((item: OrderItem) => {
        item.orderId = savedOrder.id;
      });
      
      await queryRunner.manager.save(OrderItem, orderItems);
      
      // 保存订单计价日志
      if (matchLogs) {
        const calculationLogs: OrderCalculationLog[] = [];
        
        // 处理不同类型的匹配日志
        for (const type in matchLogs) {
          if (Array.isArray(matchLogs[type])) {
            matchLogs[type].forEach((log: DiscountMatchLog) => {
              const calculationLog = new OrderCalculationLog();
              calculationLog.order_id = savedOrder.id;
              calculationLog.product_id = log.productId;
              calculationLog.rule_id = log.ruleId;
              calculationLog.discount_value = log.value;
              calculationLog.stepPrice = log.stepPrice || 0;
              calculationLog.price = log.pirce;
              
              calculationLogs.push(calculationLog);
            });
          }
        }
        
        if (calculationLogs.length > 0) {
          await queryRunner.manager.save(OrderCalculationLog, calculationLogs);
        }
      }
      
      await queryRunner.commitTransaction();
      return successResponse(res, savedOrder, '创建订单成功');
    } catch (error) {
      await queryRunner.rollbackTransaction();
      logger.error('创建订单失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    } finally {
      await queryRunner.release();
    }
  }

  async update(req: Request, res: Response): Promise<Response> {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const userId = (req as any).user.id;
    try {
      const { id } = req.params;
      const { name, type, platformId, originPrice, flashPrice, dailyPrice, promotionPrice, products, remark, matchLogs } = req.body;

      // 验证必要字段
      if (!name ||!platformId ||!products?.length) {
        return errorResponse(res, 400, '缺少必要参数', null);
      }

      // 获取订单
      const order = await queryRunner.manager.findOne(Order, {
        where: { id: Number(id) },
        relations: ['items']
      })
      if (!order) {
        return errorResponse(res, 404, '订单不存在', null);
      }

      // 更新订单信息
      order.name = name;
      order.platformId = platformId;
      order.customerId = 0;
      order.userId = userId;
      order.remark = remark;

      // 计算价格和数量
      let totalQuantity = 0;
      const orderItems = products.map((item: any) => {
        const itemTotal = item.unitPrice * item.quantity;
        totalQuantity += item.quantity;

        const orderItem = new OrderItem();
        orderItem.productId = item.id;
        orderItem.unitPrice = item.unitPrice;
        orderItem.quantity = item.quantity;
        orderItem.totalPrice = itemTotal;
        orderItem.orderId = order.id;
        return orderItem;
      })
      // 设置订单金额（假设原价和支付价格相同）
      order.authCode = 'DEFAULT_AUTH_CODE';
      order.quantity = totalQuantity;
      order.originPrice = originPrice;
      order.payPrice = flashPrice;
      order.status = Number(type) > 0? 0 : -1;   // 0 发布，-1 草稿
      order.payStatus = 0; // 未支付

      // 保存订单
      await queryRunner.manager.save(order);

      // 删除旧的订单项
      await queryRunner.manager.delete(OrderItem, { orderId: order.id });

      // 保存订单项
      await queryRunner.manager.save(OrderItem, orderItems);

      // 保存订单计价日志
      if (matchLogs) {
        const calculationLogs: OrderCalculationLog[] = [];

        // 处理不同类型的匹配日志
        for (const type in matchLogs) {
          if (Array.isArray(matchLogs[type])) {
            matchLogs[type].forEach((log: DiscountMatchLog) => {
              const calculationLog = new OrderCalculationLog();
              calculationLog.order_id = order.id;
              calculationLog.product_id = log.productId;
              calculationLog.rule_id = log.ruleId;
              calculationLog.discount_value = log.value;
              calculationLog.stepPrice = log.stepPrice || 0;
              calculationLog.price = log.pirce;

              calculationLogs.push(calculationLog);
            })
          }
        }

        // 删除旧的计价日志
        await queryRunner.manager.delete(OrderCalculationLog, { order_id: order.id });

        if (calculationLogs.length > 0) {
          await queryRunner.manager.save(OrderCalculationLog, calculationLogs);
        }
      }
      await queryRunner.commitTransaction();
      return successResponse(res, order, '更新订单成功');
    } catch (error) {
      await queryRunner.rollbackTransaction();
      logger.error('更新订单失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    } finally {
      await queryRunner.release();
    }
  }

  async getList(req: Request, res: Response): Promise<Response> {
    try {
      const userRoles = (req as any).userRoles || [];
      const userPlatforms = (req as any).accessPlatforms || [];
      const isAdmin = userRoles.includes('ADMIN');

      const { page = 1, pageSize = 20, status, username, keyword, customerId, startDate, endDate, payStatus } = req.query;
      const platformId = Number(req.query.platformId) || 0;
      
      const queryBuilder = AppDataSource.getRepository(Order)
        .createQueryBuilder('order')
        .leftJoinAndSelect('order.user', 'user')
        .leftJoinAndSelect('user.staff', 'staff');

      // 添加新的查询条件
      if (status && Array.isArray(status) && status.length > 0) queryBuilder.andWhere('order.status IN (:...status)', { status: status.map(Number) });
      if (payStatus && Array.isArray(payStatus) && payStatus.length > 0) queryBuilder.andWhere('order.payStatus IN (:...payStatus)', { payStatus: payStatus.map(Number) });
      if (startDate) queryBuilder.andWhere('order.createdAt >= :startDate', { startDate });
      if (endDate) queryBuilder.andWhere('order.createdAt <= :endDate', { endDate });
      if (customerId) queryBuilder.andWhere('order.customerId = :customerId', { customerId });
      if (platformId) {
        if (!isAdmin && !userPlatforms.includes(platformId)) {
          return errorResponse(res, 403, '没有权限', null);
        }
        queryBuilder.andWhere('order.platformId = :platformId', { platformId });
      } else {
        if (!isAdmin) {
          queryBuilder.andWhere('order.platformId IN (:...platformIds)', { platformIds: userPlatforms });
        }
      }
      if (keyword) {
        queryBuilder.andWhere('order.name LIKE :keyword', { keyword: `%${keyword}%` });
      }
      if (username) {
        queryBuilder.andWhere('user.username LIKE :username OR staff.name LIKE :username', { username: `%${username}%` });
      }

      const [orders, total] = await queryBuilder
        .orderBy('order.createdAt', 'DESC')
        .skip((Number(page) - 1) * Number(pageSize))
        .take(Number(pageSize))
        .getManyAndCount();

      const dictQueryBuilder = AppDataSource.getRepository(Dict)
      .createQueryBuilder('dict')
      .where('dict.group = :group', { group: 1 });
      const allPlatforms = await dictQueryBuilder.getMany();
      const platforms = isAdmin ? allPlatforms : allPlatforms.filter((item) => userPlatforms.includes(Number(item.value)));

      return successResponse(res, {
        orders,
        platforms,
        total,
        page: Number(page),
        pageSize: Number(pageSize)
      }, '获取订单列表成功');

    } catch (error) {
      logger.error('获取订单列表失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  async getDetail(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      
      const order = await AppDataSource.getRepository(Order)
        .createQueryBuilder('order')
        .leftJoinAndSelect('order.items', 'items')
        .leftJoinAndSelect('items.product', 'product')
        .leftJoinAndSelect('product.color','color')
        .leftJoinAndSelect('product.modelType','model')
        .leftJoinAndSelect('product.serie','series')
        .leftJoinAndMapOne(
          'order.platform',
          Dict,
          'platformDict',
          'platformDict.value = order.platformId AND platformDict.group = 1'
        )
        .where('order.id = :id', { id })
        .getOne();

      if (!order) {
        return errorResponse(res, 404, '订单不存在', null);
      }

      return successResponse(res, order, '获取订单详情成功');
    } catch (error) {
      logger.error('获取订单详情失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  async updateStatus(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { status, payStatus, reviewerId, remark } = req.body;

      const userId = (req as any).user?.id;

      // 更新逻辑增加审核人
      const updateData: Record<string, any> = {};
      if (status !== undefined) updateData.status = status;
      if (payStatus !== undefined) updateData.payStatus = payStatus;
      if (reviewerId !== undefined) updateData.reviewerId = reviewerId;

      const orderRepository = AppDataSource.getRepository(Order);

      const order = await orderRepository.findOneBy({ id: Number(id) });
      if (!order) return errorResponse(res, 404, '订单不存在', null);

      const oldStatus = order.status;
      if (oldStatus === status) return errorResponse(res, 400, '状态未改变', null);
      await orderRepository.update(order.id, updateData);

      // 记录状态变更日志
      const operatorName = (req as any).user?.username || '系统';
      const operation = '订单状态变更';
      await this.orderStatusLogService.logStatusChange(
        order.id,
        0,
        oldStatus,
        status,
        userId,
        operatorName,
        operation,
        remark
      )

      return successResponse(res, null, '更新订单状态成功');
    } catch (error) {
      logger.error('更新订单状态失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  async delete(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      
      const result = await AppDataSource.getRepository(Order)
        .update(id, { isDeleted: 1 });
  
      if (result.affected === 0) {
        return errorResponse(res, 404, '订单不存在', null);
      }
      
      return successResponse(res, null, '订单已标记删除');
    } catch (error) {
      logger.error('删除订单失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  async calculatePrice(req: Request, res: Response): Promise<Response> {
    try {
      const { platformId, products } = req.body;

      // 过滤有效产品并创建数量映射
      const validProducts = products.filter((p: any) => p.quantity > 0 && p.id);
      const productIds = validProducts.map((p: any) => p.id);
      const quantityMap = new Map(validProducts.map((p: any) => [p.id, p.quantity]));

      const productData = AppDataSource.getRepository(Product)
       .createQueryBuilder('product')
       .leftJoinAndSelect('product.color','color')
       .leftJoinAndSelect('product.modelType','model')
       .leftJoinAndSelect('product.serie', 'series')
       .where('product.id IN (:...productIds)', { productIds })
       .getMany();

      // 分类处理产品数据
      const [productMap, bonusMap] = (await productData).reduce((maps, product) => {
        const [products, bonuses] = maps;
        const targetMap = product.serie?.id === 82 ? bonuses : products;
        const quantity = Number(quantityMap.get(product.id)) || 0;
        
        targetMap.set(product.id, {
          product,
          quantity,
          unitPrice: product.basePrice
        });
        
        return maps;
      }, [new Map<number, ProductWithQuantity>(), new Map<number, ProductWithQuantity>()]);

      // 计算订单总价
      let totalBasePrice = 0;
      productMap.forEach(productWithQuantity => {
        totalBasePrice += productWithQuantity.product.basePrice * productWithQuantity.quantity;
      });
      totalBasePrice = Number(totalBasePrice.toFixed(2));
      const promotionQueryBuilder = AppDataSource.getRepository(Promotion)
        .createQueryBuilder('promotion')
        .innerJoinAndSelect('promotion.rules', 'rules')
        .where('(promotion.platformId = :platformId OR promotion.platformId = 0)', { platformId })
        .andWhere('rules.isDeleted = 0')
        .andWhere('promotion.startTime <= NOW()')
        .andWhere('promotion.endTime >= NOW()')

      const promotionData = await promotionQueryBuilder.getMany();

      const dailyDiscountResult = calculateDiscount(promotionData.filter(promotion => promotion.type === 1).flatMap(promotion => promotion.rules), productMap);
      const promotionDiscountResult = calculateDiscount(promotionData.filter(promotion => promotion.type === 2).flatMap(promotion => promotion.rules), productMap);
      const flashDiscountResult = calculateDiscount(promotionData.filter(promotion => promotion.type === 3).flatMap(promotion => promotion.rules), productMap);
      const usedBonusPoint = calculateBonusPoint(bonusMap);

      const dailyDiscount = dailyDiscountResult.discount;
      const promotionDiscount = promotionDiscountResult.discount;
      const flashDiscount = flashDiscountResult.discount;

      const dailyPrice = Number((totalBasePrice - dailyDiscount).toFixed(2));
      const promotionPrice = Number((totalBasePrice - promotionDiscount).toFixed(2));
      const flashPrice = Number((Math.min(dailyPrice, promotionPrice) - flashDiscount).toFixed(2));

      // 计算价格和数量
      const productsArray = Array.from(productMap, ([id, data]) => ({
        id,
        unitPrice: data.unitPrice,
        quantity: data.quantity
      }));
      return successResponse(res, {
        totalBasePrice,
        dailyDiscount,
        dailyPrice,
        promotionDiscount,
        promotionPrice,
        flashDiscount,
        flashPrice,
        usedBonusPoint,
        products: productsArray,
        matchLogs: {
          daily: dailyDiscountResult.matchLogs,
          promotion: promotionDiscountResult.matchLogs,
          flash: flashDiscountResult.matchLogs
        }
      }, '获取订单价格成功');
    } catch (error) {
      logger.error('获取订单价格失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }

    function calculateDiscount(rules: Array<PromotionRule>, products: Map<number, ProductWithQuantity>) {
      let totalDiscount = 0;
      
      // 创建一个Map来跟踪每个产品的累计折扣和最终单价
      const productDiscounts = new Map<number, {
        totalDiscountValue: number,  // 累计折扣值（百分比）
        totalDiscount: number,       // 累计折扣金额
        finalUnitPrice: number       // 最终单价
      }>();

      const matchLogs = [] as DiscountMatchLog[];
      
      // 遍历每条规则
      rules.forEach(rule => {
        // 筛选符合条件的产品
        products.forEach(productWithQuantity => {
          
          if (matchCondition(productWithQuantity.product, JSON.stringify(rule.condition))) {
            const productId = productWithQuantity.product.id;
            const basePrice = Number(productWithQuantity.product.basePrice);
            const currentDiscountValue = Number(rule.discountValue); // 当前规则的折扣值（百分比）
            const currentDiscount = basePrice * productWithQuantity.quantity * currentDiscountValue; // 当前规则的折扣金额
            
            // 获取产品当前的累计折扣信息，如果不存在则初始化
            const discountInfo = productDiscounts.get(productId) || {
              totalDiscountValue: 0,
              totalDiscount: 0,
              finalUnitPrice: basePrice
            };
            
            // 累加折扣值和折扣金额
            discountInfo.totalDiscountValue += currentDiscountValue;
            discountInfo.totalDiscount += currentDiscount;
            
            // 计算新的最终单价（考虑所有已应用的折扣）
            discountInfo.finalUnitPrice = basePrice * (1 - discountInfo.totalDiscountValue);
            
            // 更新产品的折扣信息
            productDiscounts.set(productId, discountInfo);

            // 记录匹配日志
            matchLogs.push({
              productId,
              ruleId: rule.id,
              name: rule.name,
              value: rule.discountValue,
              pirce: basePrice * (1 - currentDiscountValue), // 单独应用此规则的价格
              stepPrice: basePrice * (1 - discountInfo.totalDiscountValue) // 应用所有已应用的折扣后的价格
            });
          }
        });
      });

      // 更新产品Map中的单价并计算总折扣
      productDiscounts.forEach((discountInfo, productId) => {
        totalDiscount += discountInfo.totalDiscount;
        // 更新productMap中对应产品的unitPrice
        const product = products.get(productId);
        if (product) {
          // 确保最终价格不会低于0
          product.unitPrice = Math.max(0, Number(discountInfo.finalUnitPrice.toFixed(2)));
        }
      });
      
      return {
        discount: Number(totalDiscount.toFixed(2)),
        matchLogs
      };
    }
    
    // 条件匹配函数
    function matchCondition(product: { [key: string]: any }, conditionStr: string): boolean {
      // 解析JSON字符串为对象
      const condition = JSON.parse(conditionStr) as Record<string, Record<string, unknown>>;
      
      for (const [field, criteria] of Object.entries(condition)) {
        // 获取产品对应字段的值
        let productValue = product[field];
        
        // 如果是关联对象（如series, color等），获取其name属性
        if (productValue && typeof productValue === 'object' && 'name' in productValue) {
          productValue = productValue.name;
        }
        
        // 使用类型断言确保criteria是一个对象
        const typedCriteria = criteria as Record<string, unknown>;
        for (const [operator, values] of Object.entries(typedCriteria)) {
          switch (operator) {
            case 'equal':
              if (Array.isArray(values)) {
                if (!values.includes(productValue)) return false;
              } else {
                if (productValue !== values) return false;
              }
              break;
            case 'notEqual':
              if (Array.isArray(values)) {
                if (values.includes(productValue)) return false;
              } else {
                if (productValue === values) return false;
              }
              break;
            case 'in':
              if (!Array.isArray(values) || !values.includes(productValue)) return false;
              break;
            case 'notIn':
              if (!Array.isArray(values) || values.includes(productValue)) return false;
              break;
            case 'contains':
              if (!Array.isArray(values) || !values.some((pattern: string) => {
                // 处理通配符匹配
                const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
                return regex.test(productValue);
              })) return false;
              break;
            case 'greaterThanOrEqual':
              if (typeof values === 'number' && productValue < values) return false;
              break;
            case 'lessThanOrEqual':
              if (typeof values === 'number' && productValue > values) return false;
              break;
            case 'greaterThan':
              if (typeof values === 'number' && productValue <= values) return false;
              break;
            case 'lessThan':
              if (typeof values === 'number' && productValue >= values) return false;
              break;
            case 'like':
              if (typeof values === 'number' && productValue >= values) return false;
              break;
          }
        }
      }
      
      return true;
    }

    function calculateBonusPoint(products: Map<number, ProductWithQuantity>) {
      let totalBonusPoint = 0;
      products.forEach(productWithQuantity => {
        totalBonusPoint += (productWithQuantity.product.modelType?.value || 0) * productWithQuantity.quantity;
      });
      return totalBonusPoint;
    }
  }

  async getSalesReport(req: Request, res: Response): Promise<Response> {
    try {
      const userId = (req as any).user?.id;
      const userRoles = (req as any).userRoles || [];
      const isAdmin = userRoles.includes('ADMIN');
      const { type = 'personal' } = req.query;
      // 获取最近12个月的日期范围
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 11); // 获取最近12个月
      
      // 查询各平台已完成订单(status=6)的销售数据
      
      const queryBuilder = AppDataSource.getRepository(Order)
        .createQueryBuilder('order')
        .select([
          'order.platformId',
          'YEAR(order.createdAt) as year',
          'MONTH(order.createdAt) as month',
          'SUM(order.payPrice) as totalSales'
        ])
        .where('order.status = :status', { status: 6 })
        .andWhere('order.isDeleted = :isDeleted', { isDeleted: 0 })
        .andWhere('order.createdAt >= :startDate', { startDate })
        .andWhere('order.createdAt <= :endDate', { endDate })

      if (!isAdmin || (isAdmin && type === "personal")) {
        queryBuilder.andWhere('order.userId = :userId', { userId });
      }

      const salesData = await queryBuilder.groupBy('order.platformId')
        .addGroupBy('YEAR(order.createdAt)')
        .addGroupBy('MONTH(order.createdAt)')
        .orderBy('year', 'ASC')
        .addOrderBy('month', 'ASC')
        .getRawMany();
      
      // 获取平台字典数据
      const platforms = await AppDataSource.getRepository(Dict)
        .createQueryBuilder('dict')
        .where('dict.group = :group', { group: 1 })
        .getMany();
      
      // 生成月份数组（最近12个月）
      const months: string[] = [];
      for (let i = 0; i < 12; i++) {
        const date = new Date(startDate);
        date.setMonth(startDate.getMonth() + i);
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        months.push(`${year}-${month}`);
      }
      
      // 初始化销售数据数组
      const platformNames = platforms.map(p => p.name);
      const sales = Array(platformNames.length).fill(0).map(() => Array(12).fill(0));
      // 填充销售数据
      salesData.forEach(item => {
        const platformIndex = platforms.findIndex(p => Number(p.value) === item.order_platform_id);
        if (platformIndex !== -1) {
          const monthStr = `${item.year}-${item.month.toString().padStart(2, '0')}`;
          const monthIndex = months.indexOf(monthStr);
          if (monthIndex !== -1) {
            sales[platformIndex][monthIndex] = Number(item.totalSales);
          }
        }
      });
      
      // 构建返回数据
      const result = {
        months,
        platforms: platformNames,
        sales
      };
      
      return successResponse(res, result, '获取销售报表数据成功');
    } catch (error) {
      logger.error('获取销售报表数据失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  async getCategoryReport(req: Request, res: Response): Promise<Response> {
    try {
      // 查询status=6的订单商品销量
      const orderItems = await AppDataSource
        .createQueryBuilder()
        .select([
          's.name as seriesName',
          'm.name as modelName',
          'SUM(oi.quantity) as quantity'
        ])
        .from('order_items', 'oi')
        .innerJoin('orders', 'o', 'oi.order_id = o.id')
        .innerJoin('product', 'p', 'oi.product_id = p.id')
        .innerJoin('product_model', 'm', 'p.model_type_id = m.id')
        .innerJoin('product_series', 's', 'p.serie_id = s.id')
        .where('o.status = :status', { status: 6 })
        .groupBy('s.name')
        .addGroupBy('m.name')
        .getRawMany();
      
      // 处理系列销量数据
      const seriesSales = [] as any[];
      const seriesMap = new Map();
      const modelSales = [] as any[];
      const modelMap = new Map();
      
      orderItems.forEach(item => {
        const seriesName = item.seriesName;
        const modelName = item.modelName;
        const quantity = Number(item.quantity);
        
        if (seriesMap.has(seriesName)) {
          seriesMap.set(seriesName, seriesMap.get(seriesName) + quantity);
        } else {
          seriesMap.set(seriesName, quantity);
        }

        if (modelMap.has(modelName)) {
          modelMap.set(modelName, modelMap.get(modelName) + quantity);
        } else {
          modelMap.set(modelName, quantity);
        }
      });
      
      seriesMap.forEach((value, key) => {
        seriesSales.push({
          name: key,
          value
        });
      });
      
      modelMap.forEach((value, key) => {
        modelSales.push({
          name: key,
          value
        });
      })
      
      // 构建返回数据
      const result = {
        series: seriesSales,
        models: modelSales
      };
      
      return successResponse(res, result, '获取商品销量分布数据成功');
    } catch (error) {
      logger.error('获取商品销量分布数据失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 获取订单状态变更历史
  async getStatusLog(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const type = req.query.type;
      let typeNum = 0
      if (type === 'return') {
        typeNum = 1
      }
      const statusLogs = await this.orderStatusLogService.getOrderStatusHistory(Number(id), typeNum);

      return successResponse(res, statusLogs, '获取订单状态变更历史成功');
    } catch (error) {
      logger.error('获取订单状态变更历史失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
}