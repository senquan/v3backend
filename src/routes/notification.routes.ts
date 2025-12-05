import { Router, Request, Response } from 'express';
import { body, query, param } from 'express-validator';
import { NotificationController } from '../controllers/notification.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { cacheClearMiddleware } from '../middlewares/cache-clear.middleware';

const router = Router();
const notificationController = new NotificationController();

// 获取通知列表
router.get(
  '/',
  authMiddleware,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('页码必须是正整数'),
    query('pageSize').optional().isInt({ min: 1, max: 100 }).withMessage('每页数量必须在1-100之间'),
    query('type').optional().isIn(['notification', 'message', 'todo']).withMessage('类型必须是notification、message或todo'),
    query('status').optional().isIn(['info', 'success', 'warning', 'danger', 'primary']).withMessage('状态值无效'),
    query('is_read').optional().isBoolean().withMessage('已读状态必须是布尔值')
  ],
  (req: Request, res: Response) => notificationController.getNotifications(req, res)
);

// 获取通知详情
router.get(
  '/:id',
  authMiddleware,
  [
    param('id').isInt({ min: 1 }).withMessage('通知ID必须是正整数')
  ],
  (req: Request, res: Response) => notificationController.getNotificationById(req, res)
);

// 创建通知
router.post(
  '/',
  authMiddleware,
  cacheClearMiddleware('/api/v1/notifications'),
  [
    body('title').notEmpty().withMessage('通知标题不能为空'),
    body('description').optional().isString().withMessage('描述必须是字符串'),
    body('avatar').optional().isURL().withMessage('头像必须是有效的URL'),
    body('extra').optional().isString().withMessage('额外信息必须是字符串'),
    body('status').optional().isIn(['info', 'success', 'warning', 'danger', 'primary']).withMessage('状态值无效'),
    body('type').optional().isIn(['notification', 'message', 'todo']).withMessage('类型必须是notification、message或todo'),
    body('user_id').optional().isInt({ min: 1 }).withMessage('用户ID必须是正整数'),
    body('target_url').optional().isURL().withMessage('目标链接必须是有效的URL'),
    body('action_type').optional().isString().withMessage('操作类型必须是字符串')
  ],
  (req: Request, res: Response) => notificationController.createNotification(req, res)
);

// 批量创建通知
router.post(
  '/batch',
  authMiddleware,
  cacheClearMiddleware('/api/v1/notifications'),
  [
    body('notifications').isArray({ min: 1 }).withMessage('通知列表不能为空'),
    body('notifications.*.title').notEmpty().withMessage('通知标题不能为空'),
    body('notifications.*.description').optional().isString().withMessage('描述必须是字符串'),
    body('notifications.*.avatar').optional().isURL().withMessage('头像必须是有效的URL'),
    body('notifications.*.extra').optional().isString().withMessage('额外信息必须是字符串'),
    body('notifications.*.status').optional().isIn(['info', 'success', 'warning', 'danger', 'primary']).withMessage('状态值无效'),
    body('notifications.*.type').optional().isIn(['notification', 'message', 'todo']).withMessage('类型必须是notification、message或todo'),
    body('notifications.*.user_id').optional().isInt({ min: 1 }).withMessage('用户ID必须是正整数')
  ],
  (req: Request, res: Response) => notificationController.createBatchNotifications(req, res)
);

// 更新通知
router.put(
  '/:id',
  authMiddleware,
  cacheClearMiddleware('/api/v1/notifications'),
  [
    param('id').isInt({ min: 1 }).withMessage('通知ID必须是正整数'),
    body('title').optional().notEmpty().withMessage('通知标题不能为空'),
    body('description').optional().isString().withMessage('描述必须是字符串'),
    body('avatar').optional().isURL().withMessage('头像必须是有效的URL'),
    body('extra').optional().isString().withMessage('额外信息必须是字符串'),
    body('status').optional().isIn(['info', 'success', 'warning', 'danger', 'primary']).withMessage('状态值无效'),
    body('type').optional().isIn(['notification', 'message', 'todo']).withMessage('类型必须是notification、message或todo'),
    body('target_url').optional().isURL().withMessage('目标链接必须是有效的URL'),
    body('action_type').optional().isString().withMessage('操作类型必须是字符串')
  ],
  (req: Request, res: Response) => notificationController.updateNotification(req, res)
);

// 批量标记为已读
router.patch(
  '/batch/read',
  authMiddleware,
  cacheClearMiddleware('/api/v1/notifications'),
  [
    body('ids').isArray({ min: 1 }).withMessage('通知ID列表不能为空'),
    body('ids.*').isInt({ min: 1 }).withMessage('通知ID必须是正整数')
  ],
  (req: Request, res: Response) => notificationController.markBatchAsRead(req, res)
);

// 全部标记为已读
router.patch(
  '/all/read',
  authMiddleware,
  cacheClearMiddleware('/api/v1/notifications'),
  [
    body('type').optional().isIn(['notification', 'message', 'todo']).withMessage('类型必须是notification、message或todo')
  ],
  (req: Request, res: Response) => notificationController.markAllAsRead(req, res)
);

// 标记通知为已读
router.patch(
  '/:id/read',
  authMiddleware,
  cacheClearMiddleware('/api/v1/notifications'),
  [
    param('id').isInt({ min: 1 }).withMessage('通知ID必须是正整数')
  ],
  (req: Request, res: Response) => notificationController.markAsRead(req, res)
);

// 删除通知（软删除）
router.delete(
  '/:id',
  authMiddleware,
  cacheClearMiddleware('/api/v1/notifications'),
  [
    param('id').isInt({ min: 1 }).withMessage('通知ID必须是正整数')
  ],
  (req: Request, res: Response) => notificationController.deleteNotification(req, res)
);

// 批量删除通知
router.delete(
  '/batch',
  authMiddleware,
  cacheClearMiddleware('/api/v1/notifications'),
  [
    body('ids').isArray({ min: 1 }).withMessage('通知ID列表不能为空'),
    body('ids.*').isInt({ min: 1 }).withMessage('通知ID必须是正整数')
  ],
  (req: Request, res: Response) => notificationController.deleteBatchNotifications(req, res)
);

// 获取未读通知数量
router.get(
  '/unread/count',
  authMiddleware,
  [
    query('type').optional().isIn(['notification', 'message', 'todo']).withMessage('类型必须是notification、message或todo')
  ],
  (req: Request, res: Response) => notificationController.getUnreadCount(req, res)
);

export default router;