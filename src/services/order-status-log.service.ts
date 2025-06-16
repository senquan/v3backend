import { Injectable } from '@nestjs/common';
import { AppDataSource } from '../config/database';
import { OrderStatusLog } from '../models/order-status-log.model';
import { OrderStatus, ReturnOrderStatus } from '../enums/order-status.enum';

@Injectable()
export class OrderStatusLogService {
  constructor(
    private orderStatusLogRepository = AppDataSource.getRepository(OrderStatusLog),
  ) {}

  /**
   * 记录订单状态变更
   * @param orderId 订单ID
   * @param orderType 订单类型（0:普通订单, 1:退货订单）
   * @param previousStatus 变更前状态
   * @param currentStatus 变更后状态
   * @param operatorId 操作人ID
   * @param operatorName 操作人姓名
   * @param operation 操作类型
   * @param remark 备注信息
   */
  async logStatusChange(
    orderId: number,
    orderType: number,
    previousStatus: number,
    currentStatus: number,
    operatorId: number,
    operatorName: string,
    operation: string,
    remark?: string,
  ): Promise<OrderStatusLog> {
    const statusLog = new OrderStatusLog();
    statusLog.orderId = orderId;
    statusLog.orderType = orderType;
    statusLog.previousStatus = previousStatus;
    statusLog.currentStatus = currentStatus;
    statusLog.operatorId = operatorId;
    statusLog.operatorName = operatorName;
    statusLog.operation = operation;
    statusLog.remark = remark || null;

    return this.orderStatusLogRepository.save(statusLog);
  }

  /**
   * 获取订单状态变更历史
   * @param orderId 订单ID
   * @param orderType 订单类型（0:普通订单, 1:退货订单）
   */
  async getOrderStatusHistory(
    orderId: number,
    orderType: number,
  ): Promise<OrderStatusLog[]> {
    return this.orderStatusLogRepository.find({
      where: {
        orderId: orderId,
        orderType: orderType,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  /**
   * 获取状态名称
   * @param status 状态值
   * @param orderType 订单类型（0:普通订单, 1:退货订单）
   */
  getStatusName(status: number, orderType: number): string {
    if (orderType === 0) {
      return OrderStatus[status];
    } else {
      return ReturnOrderStatus[status];
    }
  }
}