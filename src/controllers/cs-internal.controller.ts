import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Customer, CustomerLevel } from '../models/customer.model';
import { Order } from '../models/order.model';
import { OrderItem } from '../models/order-item.model';
import { ExpressTracking } from '../models/express-tracking.model';
import { CsConversation } from '../models/cs-conversation.model';
import { logger } from '../utils/logger';
import { errorResponse, successResponse } from '../utils/response';
import { Like, MoreThan } from 'typeorm';

const INTERNAL_TOKEN = process.env.INTERNAL_TOKEN || '';

const CUSTOMER_LEVEL_MAP: Record<number, string> = {
  [CustomerLevel.REGULAR]: '普通客户',
  [CustomerLevel.SILVER]: '银牌客户',
  [CustomerLevel.GOLD]: '金牌客户',
  [CustomerLevel.PLATINUM]: '白金客户',
  [CustomerLevel.VIP]: 'VIP客户',
};

const ORDER_STATUS_MAP: Record<number, string> = {
  0: '待确认',
  1: '已确认',
  2: '生产中',
  3: '已发货',
  4: '已签收',
  5: '已完成',
  6: '已取消',
};

/**
 * 校验内部调用 Token（禁止空 Token，生产环境必须配置 INTERNAL_TOKEN）
 */
function verifyInternalToken(req: Request): boolean {
  const token = req.headers['x-internal-token'] as string;
  if (!INTERNAL_TOKEN) {
    logger.warn('INTERNAL_TOKEN 未配置，拒绝所有内部 API 调用');
    return false;
  }
  return token === INTERNAL_TOKEN;
}

export class CsInternalController {

  // ========== 客户订单查询（供 ai-gateway 回调） ==========

  async getCustomerOrders(req: Request, res: Response): Promise<Response> {
    try {
      if (!verifyInternalToken(req)) {
        return errorResponse(res, 403, '内部 Token 校验失败', null);
      }

      const customerId = Number(req.query.customer_id);
      const keyword = (req.query.keyword as string) || '';
      const days = Number(req.query.days) || 30;
      const limit = Math.min(Number(req.query.limit) || 5, 20);

      if (!customerId) {
        return errorResponse(res, 400, '缺少 customer_id 参数', null);
      }

      const customerRepo = AppDataSource.getRepository(Customer);
      const orderRepo = AppDataSource.getRepository(Order);
      const orderItemRepo = AppDataSource.getRepository(OrderItem);
      const expressRepo = AppDataSource.getRepository(ExpressTracking);

      // 1. 查客户信息
      const customer = await customerRepo.findOne({
        where: { id: customerId },
      });

      if (!customer) {
        return errorResponse(res, 404, '客户不存在', null);
      }

      // 2. 查最近订单
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - days);

      const orderWhere: any = {
        customerId,
        isDeleted: 0,
        createdAt: MoreThan(sinceDate),
      };

      // 关键词模糊搜索订单名称
      if (keyword) {
        orderWhere.name = Like(`%${keyword}%`);
      }

      const orders = await orderRepo.find({
        where: orderWhere,
        order: { createdAt: 'DESC' },
        take: limit,
      });

      // 3. 查订单项 + 商品名 + 快递信息
      const orderDetails = [];
      for (const order of orders) {
        const items = await orderItemRepo.find({
          where: { orderId: order.id },
          relations: ['product'],
        });

        const itemDetails = items.map(item => ({
          productName: item.product?.name || `商品#${item.productId}`,
          sku: item.product?.sku || '',
          unitPrice: Number(item.unitPrice),
          quantity: item.quantity,
        }));

        // 也搜索订单项中商品名匹配关键词的订单
        let express = null;
        const tracking = await expressRepo.findOne({
          where: { orderId: String(order.id) },
          order: { createdAt: 'DESC' },
        });

        if (tracking) {
          express = {
            trackingNumber: tracking.trackingNumber,
            expressCompanyName: tracking.expressCompanyName,
            status: tracking.status,
          };
        }

        orderDetails.push({
          id: order.id,
          name: order.name,
          status: ORDER_STATUS_MAP[order.status] || `状态${order.status}`,
          payPrice: Number(order.payPrice),
          quantity: order.quantity,
          createdAt: order.createdAt.toISOString().slice(0, 10),
          items: itemDetails,
          express,
        });
      }

      return successResponse(res, {
        customer: {
          id: customer.id,
          name: customer.name,
          level: CUSTOMER_LEVEL_MAP[customer.level] || '普通客户',
          orderCount: customer.orderCount,
          phone: customer.phone || '',
        },
        orders: orderDetails,
      }, '查询成功');
    } catch (error: any) {
      logger.error('查询客户订单失败:', error);
      return errorResponse(res, 500, `查询失败: ${error.message}`, null);
    }
  }

  // ========== 会话记录批量写入（供 ai-gateway 回调） ==========

  async saveConversationsBatch(req: Request, res: Response): Promise<Response> {
    try {
      if (!verifyInternalToken(req)) {
        return errorResponse(res, 403, '内部 Token 校验失败', null);
      }

      const { sessionId, customerId, customerName, knowledgeBaseId, relatedOrderIds, messages } = req.body;

      if (!sessionId || !messages || !Array.isArray(messages) || messages.length === 0) {
        return errorResponse(res, 400, '缺少必要参数 (sessionId, messages[])', null);
      }

      const repo = AppDataSource.getRepository(CsConversation);

      // 在单个事务中批量插入
      const entities = messages.map((msg: any) => {
        const conv = new CsConversation();
        conv.sessionId = sessionId;
        conv.customerId = customerId || null;
        conv.customerName = customerName || null;
        conv.role = msg.role;
        conv.content = msg.content;
        conv.knowledgeBaseId = knowledgeBaseId || null;
        conv.relatedOrderIds = relatedOrderIds || null;
        conv.ragSources = msg.ragSources || null;
        conv.latencyMs = msg.latencyMs || null;
        return conv;
      });

      const saved = await repo.save(entities);

      return successResponse(res, { ids: saved.map(s => s.id) }, `批量保存 ${saved.length} 条会话成功`);
    } catch (error: any) {
      logger.error('批量保存会话失败:', error);
      return errorResponse(res, 500, `批量保存失败: ${error.message}`, null);
    }
  }

  // ========== 会话记录写入（供 ai-gateway 回调，保留单条接口兼容） ==========

  async saveConversation(req: Request, res: Response): Promise<Response> {
    try {
      if (!verifyInternalToken(req)) {
        return errorResponse(res, 403, '内部 Token 校验失败', null);
      }

      const { sessionId, customerId, customerName, role, content, knowledgeBaseId, relatedOrderIds, ragSources, latencyMs } = req.body;

      if (!sessionId || !role || !content) {
        return errorResponse(res, 400, '缺少必要参数 (sessionId, role, content)', null);
      }

      const repo = AppDataSource.getRepository(CsConversation);
      const conv = new CsConversation();
      conv.sessionId = sessionId;
      conv.customerId = customerId || null;
      conv.customerName = customerName || null;
      conv.role = role;
      conv.content = content;
      conv.knowledgeBaseId = knowledgeBaseId || null;
      conv.relatedOrderIds = relatedOrderIds || null;
      conv.ragSources = ragSources || null;
      conv.latencyMs = latencyMs || null;

      await repo.save(conv);

      return successResponse(res, { id: conv.id }, '会话保存成功');
    } catch (error: any) {
      logger.error('保存会话失败:', error);
      return errorResponse(res, 500, `保存失败: ${error.message}`, null);
    }
  }

  // ========== 客户选项列表（供沙箱选择器） ==========

  async getCustomerOptions(_req: Request, res: Response): Promise<Response> {
    try {
      const repo = AppDataSource.getRepository(Customer);
      const items = await repo.find({
        select: ['id', 'name', 'level', 'orderCount'],
        order: { orderCount: 'DESC' },
        take: 50,
      });

      const result = items.map(c => ({
        id: c.id,
        name: c.name,
        level: CUSTOMER_LEVEL_MAP[c.level] || '普通客户',
        orderCount: c.orderCount,
      }));

      return successResponse(res, result, '获取客户列表成功');
    } catch (error) {
      logger.error('获取客户选项失败:', error);
      return errorResponse(res, 500, '获取客户列表失败', null);
    }
  }
}

