import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Dict } from '../models/dict.model';
import { ReturnOrder } from '../models/return-order.model';
import { ReturnOrderItem } from '../models/return-order-item.model';
import { Order } from '../models/order.model';
import { OrderStatusLogService } from '../services/order-status-log.service';
import { logger } from '../utils/logger';
import { errorResponse, successResponse } from '../utils/response';

export class ReturnOrderController {

  constructor(
    private readonly orderStatusLogService: OrderStatusLogService = new OrderStatusLogService(),
  ) {}
  
  // 创建退货订单
  async create(req: Request, res: Response): Promise<Response> {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const userId = (req as any).user?.id;
    try {
      const { orderId, reason, returns, remark } = req.body;
      // 验证必要字段
      if (!orderId || !returns?.length) {
        return errorResponse(res, 400, '缺少必要参数', null);
      }

      // 查询原订单
      const orderRepository = AppDataSource.getRepository(Order);
      const order = await orderRepository.findOne({
        where: { id: orderId, isDeleted: 0 },
        relations: ['items']
      });

      if (!order) {
        return errorResponse(res, 404, '原订单不存在', null);
      }

      // 创建退货订单
      const returnOrder = new ReturnOrder();
      returnOrder.name = `退货单-${order.name}`;
      returnOrder.orderId = order.id;
      returnOrder.platformId = order.platformId;
      returnOrder.customerId = order.customerId;
      returnOrder.userId = userId || order.userId; // 可以是当前操作用户
      returnOrder.reason = reason;
      returnOrder.remark = remark;
      returnOrder.status = 0; // 初始状态
      returnOrder.refundStatus = 0; // 未退款

      // 计算退货数量和金额
      let totalQuantity = 0;
      let totalAmount = 0;
      const returnItems: ReturnOrderItem[] = [];

      for (const item of returns) {
        // 查找原订单中的商品
        const orderItem = order.items.find(oi => oi.id === item.orderItemId);
        if (!orderItem) {
          continue;
        }

        // 验证退货数量不超过原订单数量
        const returnQty = Math.min(item.quantity, orderItem.quantity);
        if (returnQty <= 0) {
          continue;
        }

        // 计算退货金额 fixed 错误: 退货金额不能多于原订单支付金额 51.239999999999995 / 51.24
        const returnAmount = (orderItem.unitPrice * returnQty).toFixed(2);
        if (returnAmount < item.refund) {
          return errorResponse(res, 400, `退货金额不能多于原订单支付金额 ${returnAmount} / ${item.refund}`, null);
        }
      
        // 创建退货商品明细
        const returnItem = new ReturnOrderItem();
        returnItem.orderItemId = orderItem.id;
        returnItem.productId = orderItem.productId;
        returnItem.unitPrice = orderItem.unitPrice;
        returnItem.quantity = returnQty;
        returnItem.totalPrice = item.refund;
        returnItem.reason = item.reason || reason;
        
        returnItems.push(returnItem);
        totalQuantity += returnQty;
        totalAmount += item.refund;
      }

      if (returnItems.length === 0) {
        return errorResponse(res, 400, '没有有效的退货商品', null);
      }

      returnOrder.quantity = totalQuantity;
      returnOrder.returnAmount = totalAmount;

      // 保存退货订单
      const savedReturnOrder = await queryRunner.manager.save(returnOrder);
      
      // 设置关联并保存退货商品明细
      for (const item of returnItems) {
        item.returnOrderId = savedReturnOrder.id;
      }
      await queryRunner.manager.save(ReturnOrderItem, returnItems);

      // 更新原订单状态
      const previousStatus = order.status;
      order.status = 5; // 售后中
      await queryRunner.manager.save(order);

      // 记录状态变更日志
      const operatorName = (req as any).user?.username || '系统';
      const operation = '创建退货订单';
      await this.orderStatusLogService.logStatusChange(
        savedReturnOrder.id,
        1,
        order.status,
        savedReturnOrder.status,
        userId,
        operatorName,
        operation,
        remark
      )
      await this.orderStatusLogService.logStatusChange(
        orderId,
        0,
        previousStatus,
        order.status,
        userId,
        operatorName,
        operation,
        `${reason} - ${remark}`
      )
      
      await queryRunner.commitTransaction();
      return successResponse(res, savedReturnOrder, '创建退货订单成功');

    } catch (error) {
      await queryRunner.rollbackTransaction();
      logger.error('创建退货订单失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    } finally {
      await queryRunner.release();
    }
  }

  // 获取退货订单列表
  async getList(req: Request, res: Response): Promise<Response> {
    try {
      const { page = 1, pageSize = 20, status, customerId, orderId, startDate, endDate, username } = req.query;

      const userRoles = (req as any).userRoles || [];
      const userPlatforms = (req as any).accessPlatforms || [];
      const isAdmin = userRoles.includes('ADMIN');
      
      const queryBuilder = AppDataSource.getRepository(ReturnOrder)
        .createQueryBuilder('returnOrder')
        .leftJoinAndSelect('returnOrder.user', 'user')
        .leftJoinAndSelect('user.staff', 'staff')
        //.leftJoinAndSelect('returnOrder.items', 'items')
        .where('returnOrder.isDeleted = :isDeleted', { isDeleted: 0 });

      // 添加查询条件
      if (status !== undefined) {
        queryBuilder.andWhere('returnOrder.status = :status', { status });
      }
      
      if (customerId) {
        queryBuilder.andWhere('returnOrder.customerId = :customerId', { customerId });
      }

      if (startDate) queryBuilder.andWhere('returnOrder.createdAt >= :startDate', { startDate });
      if (endDate) queryBuilder.andWhere('returnOrder.createdAt <= :endDate', { endDate: endDate + " 23:59:59" });
      
      if (orderId) {
        queryBuilder.andWhere('returnOrder.orderId = :orderId', { orderId });
      }

      if (username) {
        queryBuilder.andWhere('(user.username LIKE :username OR staff.name LIKE :username)', { username: `%${username}%` });
      }

      // 分页查询
      const [returnOrders, total] = await queryBuilder
        .orderBy('returnOrder.createdAt', 'DESC')
        .skip((Number(page) - 1) * Number(pageSize))
        .take(Number(pageSize))
        .getManyAndCount();

      const dictQueryBuilder = AppDataSource.getRepository(Dict)
      .createQueryBuilder('dict')
      .where('dict.group = :group', { group: 1 });
      const allPlatforms = await dictQueryBuilder.getMany();
      const platforms = isAdmin ? allPlatforms : allPlatforms.filter((item) => userPlatforms.includes(Number(item.value)));

      return successResponse(res, {
        returnOrders,
        platforms,
        total,
        page: Number(page),
        pageSize: Number(pageSize)
      }, '获取退货订单列表成功');

    } catch (error) {
      logger.error('获取退货订单列表失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 获取退货订单详情
  async getDetail(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      
      const returnOrder = await AppDataSource.getRepository(ReturnOrder)
        .createQueryBuilder('returnOrder')
        .leftJoinAndSelect('returnOrder.items', 'items')
        .leftJoinAndSelect('items.product', 'product')
        .leftJoinAndSelect('product.modelType','model')
        .leftJoinAndSelect('product.serie','series')
        .leftJoinAndSelect('returnOrder.order', 'order')
        .where('returnOrder.id = :id', { id })
        .andWhere('returnOrder.isDeleted = :isDeleted', { isDeleted: 0 })
        .getOne();

      if (!returnOrder) {
        return errorResponse(res, 404, '退货订单不存在', null);
      }

      return successResponse(res, returnOrder, '获取退货订单详情成功');
    } catch (error) {
      logger.error('获取退货订单详情失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 更新退货订单状态
  async updateStatus(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { status, refundStatus, reviewerId } = req.body;

      const updateData: Record<string, any> = {};
      
      if (status !== undefined) {
        updateData.status = status;
      }
      
      if (refundStatus !== undefined) {
        updateData.refundStatus = refundStatus;
        if (refundStatus === 1) { // 已退款
          updateData.refundAt = new Date();
        }
      }
      
      if (reviewerId) {
        updateData.reviewerId = reviewerId;
      }

      const result = await AppDataSource.getRepository(ReturnOrder)
        .update({ id: Number(id), isDeleted: 0 }, updateData);

      if (result.affected === 0) {
        return errorResponse(res, 404, '退货订单不存在', null);
      }

      return successResponse(res, null, '更新退货订单状态成功');
    } catch (error) {
      logger.error('更新退货订单状态失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 删除退货订单（软删除）
  async delete(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      
      const result = await AppDataSource.getRepository(ReturnOrder)
        .update({ id: Number(id), isDeleted: 0 }, { isDeleted: 1 });

      if (result.affected === 0) {
        return errorResponse(res, 404, '退货订单不存在', null);
      }

      return successResponse(res, null, '删除退货订单成功');
    } catch (error) {
      logger.error('删除退货订单失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
}
