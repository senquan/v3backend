import { WebSocketService } from '../utils/websocket';
import { logger } from '../utils/logger';

export interface NotificationPayload {
  type: string;
  title?: string;
  message?: string;
  userId?: string;
  data?: any;
  timestamp?: Date;
}

export class NotificationService {
  private static instance: NotificationService;
  private webSocketService: WebSocketService;

  private constructor() {
    this.webSocketService = WebSocketService.getInstance();
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * 向所有连接的客户端发送通知
   */
  public sendToAll(notification: NotificationPayload): void {
    const message = {
      type: 'notification',
      payload: {
        ...notification,
        timestamp: notification.timestamp || new Date()
      }
    };

    this.webSocketService.broadcast(message);
    logger.info(`Notification sent to all clients: ${notification.type}`);
  }

  /**
   * 向特定用户发送通知
   */
  public sendToUser(userId: string, notification: NotificationPayload): void {
    const message = {
      type: 'notification',
      payload: {
        ...notification,
        timestamp: notification.timestamp || new Date()
      }
    };

    const sent = this.webSocketService.sendToUserId(userId, message);
    if (sent) {
      logger.info(`Notification sent to user ${userId}: ${notification.type}`);
    } else {
      logger.warn(`Failed to send notification to user ${userId}: user not connected`);
    }
  }

  /**
   * 向特定客户端发送通知
   */
  public sendToClient(clientId: string, notification: NotificationPayload): void {
    const message = {
      type: 'notification',
      payload: {
        ...notification,
        timestamp: notification.timestamp || new Date()
      }
    };

    const sent = this.webSocketService.sendToClientId(clientId, message);
    if (sent) {
      logger.info(`Notification sent to client ${clientId}: ${notification.type}`);
    } else {
      logger.warn(`Failed to send notification to client ${clientId}: client not found or not connected`);
    }
  }

  /**
   * 发送系统通知
   */
  public sendSystemNotification(message: string, data?: any): void {
    this.sendToAll({
      type: 'system',
      title: 'System Notification',
      message,
      data
    });
  }

  /**
   * 发送用户通知
   */
  public sendUserNotification(userId: string, title: string, message: string, data?: any): void {
    this.sendToUser(userId, {
      type: 'user',
      title,
      message,
      userId,
      data
    });
  }

  /**
   * 发送事件通知
   */
  public sendEventNotification(eventType: string, data: any): void {
    this.sendToAll({
      type: 'event',
      title: `New ${eventType}`,
      message: `A new ${eventType} event occurred`,
      data
    });
  }

  /**
   * 发送错误通知
   */
  public sendErrorNotification(message: string, errorData?: any): void {
    this.sendToAll({
      type: 'error',
      title: 'Error',
      message,
      data: errorData
    });
  }
}

// 导出单例实例的便捷方法
export const notificationService = NotificationService.getInstance();