import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Notification } from '../models/notification.model';
import { logger } from '../utils/logger';
import { errorResponse, successResponse } from '../utils/response';
import { Like, In } from 'typeorm';
import { NotificationService } from '../services/notification.service';

export class NotificationController {
  // 获取通知列表
  async getNotifications(req: Request, res: Response): Promise<Response> {
    try {
      const userId = (req as any).user?.id;
      const {
        page = 1,
        pageSize = 10,
        type,
        status,
        isRead,
        keyword
      } = req.query;

      const notificationRepository = AppDataSource.getRepository(Notification);
      const queryBuilder = notificationRepository.createQueryBuilder('notification');

      // 基础查询条件
      queryBuilder.where('notification.is_active = :isActive', { isActive: 1 });

      // 如果指定了用户ID，则只查询该用户的通知，否则查询全局通知
      if (userId) {
        queryBuilder.andWhere(
          '(notification.userId = :userId OR notification.userId IS NULL)',
          { userId }
        );
      }

      // 类型筛选
      if (type) {
        queryBuilder.andWhere('notification.type = :type', { type });
      }

      // 状态筛选
      if (status) {
        queryBuilder.andWhere('notification.status = :status', { status });
      }

      // 已读状态筛选
      if (isRead !== undefined) {
        queryBuilder.andWhere('notification.is_read = :isRead', { isRead: isRead === 'true' });
      }

      // 关键词搜索
      if (keyword) {
        queryBuilder.andWhere(
          '(notification.title LIKE :keyword OR notification.description LIKE :keyword)',
          { keyword: `%${keyword}%` }
        );
      }

      // 排序
      queryBuilder.orderBy('notification.createdAt', 'DESC');

      // 分页
      const skip = (Number(page) - 1) * Number(pageSize);
      queryBuilder.skip(skip).take(Number(pageSize));

      const [notifications, total] = await queryBuilder.getManyAndCount();

      // 格式化返回数据
      const formattedNotifications = notifications.map(notification => ({
        id: notification.id,
        avatar: notification.avatar,
        title: notification.title,
        description: notification.description,
        extra: notification.extra,
        status: notification.status,
        type: notification.type,
        isRead: notification.isRead,
        targetUrl: notification.targetUrl,
        actionType: notification.actionType,
        datetime: notification.getFormattedDatetime(),
        createdAt: notification.createdAt,
        updatedAt: notification.updatedAt
      }));

      return successResponse(res, {
        notifications: formattedNotifications,
        total,
        page: Number(page),
        pageSize: Number(pageSize),
        totalPages: Math.ceil(total / Number(pageSize))
      }, '获取通知列表成功');
    } catch (error) {
      logger.error('获取通知列表失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 获取通知详情
  async getNotificationById(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;

      const notificationRepository = AppDataSource.getRepository(Notification);
      const queryBuilder = notificationRepository.createQueryBuilder('notification');

      queryBuilder.where('notification.id = :id', { id })
        .andWhere('notification.is_active = :isActive', { isActive: 1 });

      if (userId) {
        queryBuilder.andWhere(
          '(notification.userId = :userId OR notification.userId IS NULL)',
          { userId }
        );
      }

      const notification = await queryBuilder.getOne();

      if (!notification) {
        return errorResponse(res, 404, '通知不存在', null);
      }

      return successResponse(res, {
        id: notification.id,
        avatar: notification.avatar,
        title: notification.title,
        description: notification.description,
        extra: notification.extra,
        status: notification.status,
        type: notification.type,
        isRead: notification.isRead,
        targetUrl: notification.targetUrl,
        actionType: notification.actionType,
        actionData: notification.actionData,
        datetime: notification.getFormattedDatetime(),
        createdAt: notification.createdAt,
        updatedAt: notification.updatedAt
      }, '获取通知详情成功');
    } catch (error) {
      logger.error('获取通知详情失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 创建通知
  async createNotification(req: Request, res: Response): Promise<Response> {
    try {
      const {
        title,
        description,
        avatar,
        extra,
        status = 'info',
        type = 'notification',
        userId,
        targetUrl,
        actionType,
        actionData
      } = req.body;

      if (!title) {
        return errorResponse(res, 400, '通知标题不能为空', null);
      }

      const notificationRepository = AppDataSource.getRepository(Notification);
      const notification = notificationRepository.create({
        title,
        description,
        avatar,
        extra,
        status,
        type,
        userId,
        targetUrl,
        actionType,
        actionData: actionData ? JSON.stringify(actionData) : null
      });

      await notificationRepository.save(notification);

      return successResponse(res, {
        id: notification.id,
        title: notification.title,
        type: notification.type,
        status: notification.status
      }, '创建通知成功');
    } catch (error) {
      logger.error('创建通知失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 批量创建通知
  async createBatchNotifications(req: Request, res: Response): Promise<Response> {
    try {
      const { notifications } = req.body;

      if (!Array.isArray(notifications) || notifications.length === 0) {
        return errorResponse(res, 400, '通知数据不能为空', null);
      }

      const notificationRepository = AppDataSource.getRepository(Notification);
      const createdNotifications = [];

      for (const notifyData of notifications) {
        const {
          title,
          description,
          avatar,
          extra,
          status = 'info',
          type = 'notification',
          userId,
          targetUrl,
          actionType,
          actionData
        } = notifyData;

        if (!title) continue;

        const notification = notificationRepository.create({
          title,
          description,
          avatar,
          extra,
          status,
          type,
          userId,
          targetUrl,
          actionType,
          actionData: actionData ? JSON.stringify(actionData) : null
        });

        await notificationRepository.save(notification);
        createdNotifications.push(notification);
      }

      return successResponse(res, {
        count: createdNotifications.length,
        notifications: createdNotifications.map(n => ({
          id: n.id,
          title: n.title,
          type: n.type
        }))
      }, `批量创建通知成功，共创建${createdNotifications.length}条`);
    } catch (error) {
      logger.error('批量创建通知失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 更新通知
  async updateNotification(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const {
        title,
        description,
        avatar,
        extra,
        status,
        type,
        targetUrl,
        actionType,
        actionData
      } = req.body;

      const notificationRepository = AppDataSource.getRepository(Notification);
      const notification = await notificationRepository.findOne({
        where: { id: Number(id), isActive: 1 }
      });

      if (!notification) {
        return errorResponse(res, 404, '通知不存在', null);
      }

      // 更新字段
      if (title !== undefined) notification.title = title;
      if (description !== undefined) notification.description = description;
      if (avatar !== undefined) notification.avatar = avatar;
      if (extra !== undefined) notification.extra = extra;
      if (status !== undefined) notification.status = status;
      if (type !== undefined) notification.type = type;
      if (targetUrl !== undefined) notification.targetUrl = targetUrl;
      if (actionType !== undefined) notification.actionType = actionType;
      if (actionData !== undefined) {
        notification.actionData = actionData ? JSON.stringify(actionData) : null;
      }

      await notificationRepository.save(notification);

      return successResponse(res, {
        id: notification.id,
        title: notification.title,
        type: notification.type,
        status: notification.status
      }, '更新通知成功');
    } catch (error) {
      logger.error('更新通知失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 标记通知为已读
  async markAsRead(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;

      const notificationRepository = AppDataSource.getRepository(Notification);
      const queryBuilder = notificationRepository.createQueryBuilder('notification');

      queryBuilder.where('notification.id = :id', { id })
        .andWhere('notification.is_active = :isActive', { isActive: 1 });

      if (userId) {
        queryBuilder.andWhere(
          '(notification.userId = :userId OR notification.userId IS NULL)',
          { userId }
        );
      }

      const notification = await queryBuilder.getOne();

      if (!notification) {
        return errorResponse(res, 404, '通知不存在', null);
      }

      notification.markAsRead();
      await notificationRepository.save(notification);

      return successResponse(res, null, '标记为已读成功');
    } catch (error) {
      logger.error('标记通知为已读失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 批量标记为已读
  async markBatchAsRead(req: Request, res: Response): Promise<Response> {
    try {
      const { ids } = req.body;
      const userId = (req as any).user?.id;

      if (!Array.isArray(ids) || ids.length === 0) {
        return errorResponse(res, 400, '通知ID列表不能为空', null);
      }
      
      const notificationService = new NotificationService();
      const count = await notificationService.markBatchAsRead(ids as number[], userId);

      return successResponse(res, count, '批量标记为已读成功');
    } catch (error) {
      logger.error('批量标记通知为已读失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 删除通知（软删除）
  async deleteNotification(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;

      const notificationRepository = AppDataSource.getRepository(Notification);
      const notification = await notificationRepository.findOne({
        where: { id: Number(id), isActive: 1 }
      });

      if (!notification) {
        return errorResponse(res, 404, '通知不存在', null);
      }

      // 软删除
      notification.isActive = 0;
      await notificationRepository.save(notification);

      return successResponse(res, null, '删除通知成功');
    } catch (error) {
      logger.error('删除通知失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 批量删除通知
  async deleteBatchNotifications(req: Request, res: Response): Promise<Response> {
    try {
      const { ids } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return errorResponse(res, 400, '通知ID列表不能为空', null);
      }

      const notificationRepository = AppDataSource.getRepository(Notification);
      await notificationRepository.update(
        { id: In(ids), isActive: 1 },
        { isActive: 0, updatedAt: new Date() }
      );

      return successResponse(res, null, '批量删除通知成功');
    } catch (error) {
      logger.error('批量删除通知失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 获取未读通知数量
  async getUnreadCount(req: Request, res: Response): Promise<Response> {
    try {
      const userId = (req as any).user?.id;
      const { type } = req.query;

      const notificationRepository = AppDataSource.getRepository(Notification);
      const queryBuilder = notificationRepository.createQueryBuilder('notification');

      queryBuilder.select('notification.type', 'type')
          .addSelect('COUNT(notification.id)', 'count')
          .where('notification.is_active = :isActive', { isActive: 1 })
          .andWhere('notification.is_read = :isRead', { isRead: false });

      if (userId) {
        queryBuilder.andWhere(
          '(notification.userId = :userId OR notification.userId IS NULL)',
          { userId }
        );
      }

      if (type) {
        queryBuilder.andWhere('notification.type = :type', { type });
      }
      const data = await queryBuilder.groupBy('notification.type')
        .getRawMany();


      const result = {
        notification: 0,
        message: 0,
        todo: 0
      };
      data.forEach(item => {
        if (item.type in result) {
          result[item.type as keyof typeof result] = Number(item.count);
        }
      })

      return successResponse(res, result, '获取未读通知数量成功');
    } catch (error) {
      logger.error('获取未读通知数量失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 全部标记为已读
  async markAllAsRead(req: Request, res: Response): Promise<Response> {
    try {
      const userId = (req as any).user?.id;
      const { type } = req.query;
      const notificationService = new NotificationService();
      const count = await notificationService.markAllAsRead(userId, String(type));

      return successResponse(res, count, '全部标记为已读成功');
    } catch (error) {
      logger.error('全部标记为已读失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
}