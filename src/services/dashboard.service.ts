import { AppDataSource } from '../config/database';
import { Order } from '../models/order.model';
import { ReturnOrder } from '../models/return-order.model';
import { Ticket } from '../models/ticket.model';
import { Customer } from '../models/customer.model';
import { Between, In, Not } from 'typeorm';

export class DashboardService {
  /**
   * 获取仪表盘统计数据
   * @param userId 用户ID
   * @returns 统计数据对象
   */
  async getDashboardStats(userId: number) {
    // 获取当前月份的开始和结束日期
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    
    // 获取订单相关统计
    const orderStats = await this.getOrderStats(userId, firstDayOfMonth, lastDayOfMonth);
    
    // 获取工单相关统计
    const ticketStats = await this.getTicketStats(userId, firstDayOfMonth, lastDayOfMonth);
    
    // 获取客户相关统计
    const customerStats = await this.getCustomerStats(userId, firstDayOfMonth, lastDayOfMonth);
    
    return {
      ...orderStats,
      ...ticketStats,
      ...customerStats
    };
  }
  
  /**
   * 获取订单相关统计
   */
  private async getOrderStats(userId: number, startDate: Date, endDate: Date) {
    const orderRepo = AppDataSource.getRepository(Order);
    const returnOrderRepo = AppDataSource.getRepository(ReturnOrder);
    
    // 查询条件
    const baseWhere = {
      userId,
      isDeleted: 0,
      createdAt: Between(startDate, endDate)
    };
    
    // 本月订单总额
    const monthOrderAmount = await orderRepo.createQueryBuilder('order')
      .select('SUM(order.payPrice)', 'total')
      .where(baseWhere)
      .getRawOne()
      .then(result => result?.total || 0);
    
    // 已完成订单总额
    const monthFinished = await orderRepo.createQueryBuilder('order')
      .select('SUM(order.payPrice)', 'total')
      .where({
        ...baseWhere,
        status: In([2, 3, 4]) // 假设2,3,4是已完成状态
      })
      .getRawOne()
      .then(result => result?.total || 0);
    
    // 售后订单总额
    const monthCs = await returnOrderRepo.createQueryBuilder('return')
      .select('SUM(return.returnAmount)', 'total')
      .where({
        userId,
        isDeleted: 0,
        createdAt: Between(startDate, endDate)
      })
      .getRawOne()
      .then(result => result?.total || 0);
    
    // 订单总数
    const monthOrderCount = await orderRepo.count({
      where: baseWhere
    });
    
    // 已完成订单总数
    const monthFinishedCount = await orderRepo.count({
      where: {
        ...baseWhere,
        status: In([2, 3, 4]) // 假设2,3,4是已完成状态
      }
    });
    
    // 售后订单总数
    const monthCsCount = await returnOrderRepo.count({
      where: {
        userId,
        isDeleted: 0,
        createdAt: Between(startDate, endDate)
      }
    });
    
    return {
      monthOrderAmount,
      monthFinished,
      monthCs,
      monthOrderCount,
      monthFinishedCount,
      monthCsCount
    };
  }
  
  /**
   * 获取工单相关统计
   */
  private async getTicketStats(userId: number, startDate: Date, endDate: Date) {
    const ticketRepo = AppDataSource.getRepository(Ticket);
    
    // 本月处理的工单数量
    const monthTicketAmount = await ticketRepo.count({
      where: {
        assigneeId: userId,
        isDeleted: 0,
        status: In([3, 4]), // 假设3,4是已处理状态
        processedAt: Between(startDate, endDate)
      }
    });
    
    // 本月工单总量
    const monthTotalTickets = await ticketRepo.count({
      where: {
        assigneeId: userId,
        isDeleted: 0,
        createdAt: Between(startDate, endDate)
      }
    });
    
    // 计算工单完成率
    const monthTicketRate = monthTotalTickets > 0 
      ? Math.round((monthTicketAmount / monthTotalTickets) * 100) 
      : 0;
    
    return {
      monthTicketAmount,
      monthTotalTickets,
      monthTicketRate
    };
  }
  
  /**
   * 获取客户相关统计
   */
  private async getCustomerStats(userId: number, startDate: Date, endDate: Date) {
    const customerRepo = AppDataSource.getRepository(Customer);
    const orderRepo = AppDataSource.getRepository(Order);
    
    // 本月新增客户数
    const monthCustomerCount = await customerRepo.count({
      where: {
        createdAt: Between(startDate, endDate)
      }
    });
    
    // 客户总数
    const totalCustomerCount = await customerRepo.count({
      where: {
        isDeleted: 0
      }
    });
    
    // 查询本月有回购的客户
    // 先找出本月下单的客户ID
    const monthCustomers = await orderRepo.createQueryBuilder('order')
      .select('DISTINCT order.customerId', 'customerId')
      .where({
        userId,
        isDeleted: 0,
        createdAt: Between(startDate, endDate)
      })
      .getRawMany();
    
    const customerIds = monthCustomers.map(item => item.customerId);
    
    // 查询这些客户在本月之前是否有订单
    let monthBackCount = 0;
    if (customerIds.length > 0) {
      monthBackCount = await orderRepo.createQueryBuilder('order')
        .select('COUNT(DISTINCT order.customerId)', 'count')
        .where({
          customerId: In(customerIds),
          isDeleted: 0,
          createdAt: Not(Between(startDate, endDate))
        })
        .getRawOne()
        .then(result => result?.count || 0);
    }
    
    return {
      monthCustomerCount,
      totalCustomerCount,
      monthBackCount
    };
  }
}