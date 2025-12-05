import { AppDataSource } from '../config/database';
import { Notification } from '../models/notification.model';
import { Staff } from '../models/staff.model';
import { Ticket } from '../models/ticket.model';
import { logger } from '../utils/logger';
import { RedisCacheService } from '../services/cache.service';

// 获取缓存服务实例
const cacheService = new RedisCacheService();

export class NotificationService {
  /**
   * 创建通知
   * @param notificationData 通知数据
   */
  async createNotification(notificationData: {
    title: string;
    description?: string;
    avatar?: string;
    extra?: string;
    status?: string;
    type?: string;
    userId?: number;
    targetUrl?: string;
    actionType?: string;
    actionData?: any;
  }): Promise<Notification> {
    try {
      const notificationRepository = AppDataSource.getRepository(Notification);
      
      const notification = notificationRepository.create({
        title: notificationData.title,
        description: notificationData.description,
        avatar: notificationData.avatar,
        extra: notificationData.extra,
        status: notificationData.status || 'info',
        type: notificationData.type || 'notification',
        userId: notificationData.userId,
        targetUrl: notificationData.targetUrl,
        actionType: notificationData.actionType,
        actionData: notificationData.actionData ? JSON.stringify(notificationData.actionData) : null
      });

      const savedNotification = await notificationRepository.save(notification);
      logger.info(`通知创建成功: ${savedNotification.id}`);
      await cacheService.clearCacheByPath('/api/v1/notifications');
      
      return savedNotification;
    } catch (error) {
      logger.error('创建通知失败:', error);
      throw error;
    }
  }

  /**
   * 批量创建通知
   * @param notifications 通知数据数组
   */
  async createBatchNotifications(notifications: Array<{
    title: string;
    description?: string;
    avatar?: string;
    extra?: string;
    status?: string;
    type?: string;
    userId?: number;
    targetUrl?: string;
    actionType?: string;
    actionData?: any;
  }>): Promise<Notification[]> {
    try {
      const notificationRepository = AppDataSource.getRepository(Notification);
      
      const notificationEntities = notifications.map(data => 
        notificationRepository.create({
          title: data.title,
          description: data.description,
          avatar: data.avatar,
          extra: data.extra,
          status: data.status || 'info',
          type: data.type || 'notification',
          userId: data.userId,
          targetUrl: data.targetUrl,
          actionType: data.actionType,
          actionData: data.actionData ? JSON.stringify(data.actionData) : null
        })
      );

      const savedNotifications = await notificationRepository.save(notificationEntities);
      logger.info(`批量创建通知成功: ${savedNotifications.length} 条`);
      
      return savedNotifications;
    } catch (error) {
      logger.error('批量创建通知失败:', error);
      throw error;
    }
  }

  /**
   * 将员工ID转换为用户ID
   * @param staffId 员工ID
   * @returns 用户ID或null
   */
  async convertStaffIdToUserId(staffId: number): Promise<number | null> {
    try {
      const staffRepository = AppDataSource.getRepository(Staff);
      
      const staff = await staffRepository.findOne({
        where: { 
          id: staffId,
          isDeleted: 0
        },
        relations: ['user']
      });

      if (!staff || !staff.user) {
        logger.warn(`员工ID ${staffId} 未找到对应的用户`);
        return null;
      }

      return staff.user.id;
    } catch (error) {
      logger.error(`转换员工ID到用户ID失败: ${staffId}`, error);
      throw error;
    }
  }

  /**
   * 为新建工单创建待办通知
   * @param ticket 工单对象
   */
  async createTicketTodoNotification(ticket: Ticket): Promise<void> {
    try {
      // 如果工单没有指派人员，则不创建通知
      if (!ticket.assigneeId) {
        logger.info(`工单 ${ticket.id} 未指派处理人，跳过创建通知`);
        return;
      }

      // 将员工ID转换为用户ID
      const userId = await this.convertStaffIdToUserId(ticket.assigneeId);
      if (!userId) {
        logger.warn(`工单 ${ticket.id} 的指派人员 ${ticket.assigneeId} 未找到对应用户，无法创建通知`);
        return;
      }

      // 获取工单类型描述
      const ticketTypeMap: { [key: number]: string } = {
        1: '咨询',
        2: '投诉', 
        3: '售后',
        4: '建议'
      };

      // 获取优先级描述
      const priorityMap: { [key: number]: { text: string; status: string } } = {
        1: { text: '日常', status: 'info' },
        2: { text: '一般', status: 'primary' },
        3: { text: '紧急', status: 'warning' },
        4: { text: '加急', status: 'warning' },
        5: { text: '特急', status: 'danger' }
      };

      const ticketTypeText = ticketTypeMap[ticket.ticketType] || '未知';
      const priorityInfo = priorityMap[ticket.priority] || { text: '一般', status: 'primary' };

      // 创建待办通知
      await this.createNotification({
        title: `新工单待处理：${ticket.title}`,
        description: `工单类型：${ticketTypeText} | 优先级：${priorityInfo.text}`,
        avatar: '',
        extra: `#${ticket.id}`,
        status: priorityInfo.status,
        type: 'todo',
        userId: userId,
        targetUrl: `/ticket/detail/${ticket.id}`,
        actionType: 'ticket_assigned',
        actionData: {
          ticketId: ticket.id,
          ticketType: ticket.ticketType,
          priority: ticket.priority,
          assigneeId: ticket.assigneeId
        }
      });

      logger.info(`为工单 ${ticket.id} 创建待办通知成功，通知用户: ${userId}`);
    } catch (error) {
      logger.error(`为工单 ${ticket.id} 创建待办通知失败:`, error);
      // 不抛出错误，避免影响工单创建流程
    }
  }

  /**
   * 为工单状态变更创建通知
   * @param ticket 工单对象
   * @param oldStatus 原状态
   * @param newStatus 新状态
   */
  async createTicketStatusChangeNotification(ticket: Ticket, oldStatus: number, newStatus: number): Promise<void> {
    try {
      const statusMap: { [key: number]: string } = {
        1: '待处理',
        2: '处理中',
        3: '待确认',
        4: '已关闭',
        5: '已取消'
      };

      const oldStatusText = statusMap[oldStatus] || '未知';
      const newStatusText = statusMap[newStatus] || '未知';

      // 通知工单创建者
      if (ticket.creatorId) {
        await this.createNotification({
          title: `工单状态更新：${ticket.title}`,
          description: `状态从「${oldStatusText}」变更为「${newStatusText}」`,
          avatar: '/icons/ticket-status.svg',
          extra: `#${ticket.id}`,
          status: newStatus === 4 ? 'success' : 'info',
          type: 'notification',
          userId: ticket.creatorId,
          targetUrl: `/ticket/detail/${ticket.id}`,
          actionType: 'ticket_status_changed',
          actionData: {
            ticketId: ticket.id,
            oldStatus,
            newStatus
          }
        });
      }

      logger.info(`为工单 ${ticket.id} 状态变更创建通知成功`);
    } catch (error) {
      logger.error(`为工单 ${ticket.id} 状态变更创建通知失败:`, error);
    }
  }

  /**
   * 标记通知为已读
   * @param notificationId 通知ID
   * @param userId 用户ID
   */
  async markAsRead(notificationId: number, userId?: number): Promise<boolean> {
    try {
      const notificationRepository = AppDataSource.getRepository(Notification);
      
      const queryBuilder = notificationRepository.createQueryBuilder()
        .update(Notification)
        .set({ isRead: true, updatedAt: new Date() })
        .where('id = :id', { id: notificationId });

      if (userId) {
        queryBuilder.andWhere('(userId = :userId OR userId IS NULL)', { userId });
      }

      const result = await queryBuilder.execute();
      
      return result.affected ? result.affected > 0 : false;
    } catch (error) {
      logger.error(`标记通知 ${notificationId} 为已读失败:`, error);
      throw error;
    }
  }

  /**
   * 批量标记通知为已读
   * @param notificationIds 通知ID数组
   * @param userId 用户ID
   */
  async markBatchAsRead(notificationIds: number[], userId?: number): Promise<number> {
    try {
      const notificationRepository = AppDataSource.getRepository(Notification);
      
      const queryBuilder = notificationRepository.createQueryBuilder()
        .update(Notification)
        .set({ isRead: true, updatedAt: new Date() })
        .whereInIds(notificationIds);

      if (userId) {
        queryBuilder.andWhere('(userId = :userId OR userId IS NULL)', { userId });
      }

      const result = await queryBuilder.execute();
      
      return result.affected || 0;
    } catch (error) {
      logger.error('批量标记通知为已读失败:', error);
      throw error;
    }
  }

  /**
   * 批量标记用户所有类型通知已读
   * @param type 类型
   * @param userId 用户ID
   */
  async markAllAsRead(userId: number, type?: string): Promise<number> {
    try {
      const notificationRepository = AppDataSource.getRepository(Notification);
      const queryBuilder = notificationRepository.createQueryBuilder()
        .update(Notification)
        .set({ isRead: true, updatedAt: new Date() })
        .where('(userId = :userId OR userId IS NULL)', { userId });

      if (type) {
        queryBuilder.andWhere('type = :type', { type });
      } else {
        return 0
      }
      const result = await queryBuilder.execute();
      return result.affected || 0;
    } catch (error) {
      logger.error('批量标记用户所有类型通知已读失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户未读通知数量
   * @param userId 用户ID
   * @param type 通知类型
   */
  async getUnreadCount(userId: number, type?: string): Promise<number> {
    try {
      const notificationRepository = AppDataSource.getRepository(Notification);
      
      const queryBuilder = notificationRepository.createQueryBuilder('notification')
        .where('notification.isActive = :isActive', { isActive: 1 })
        .andWhere('notification.isRead = :isRead', { isRead: false })
        .andWhere('(notification.userId = :userId OR notification.userId IS NULL)', { userId });

      if (type) {
        queryBuilder.andWhere('notification.type = :type', { type });
      }

      return await queryBuilder.getCount();
    } catch (error) {
      logger.error(`获取用户 ${userId} 未读通知数量失败:`, error);
      throw error;
    }
  }
}