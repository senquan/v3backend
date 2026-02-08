import { Request, Response } from 'express';
import { notificationService } from '../services/ws.notification.service';
import { logger } from '../utils/logger';
import { WebSocketService } from '../utils/websocket';

export const sendNotification = (req: Request, res: Response) => {
  try {
    const { userId, title, message, type = 'test' } = req.body;

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Title and message are required'
      });
    }

    const notification = {
      type,
      title,
      message,
      data: req.body.data || null
    };

    if (userId) {
      notificationService.sendToUser(userId, notification);
    } else {
      notificationService.sendToAll(notification);
    }

    res.json({
      success: true,
      message: 'Notification sent successfully'
    });
  } catch (error) {
    logger.error('Error sending test notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send notification'
    });
  }
};

export const getWebSocketStats = (req: Request, res: Response) => {
  try {
    const webSocketService = WebSocketService.getInstance();
    const stats = webSocketService.getStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error getting WebSocket stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get WebSocket stats'
    });
  }
};