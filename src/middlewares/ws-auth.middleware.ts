import { WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { logger } from '../utils/logger';

/**
 * WebSocket认证中间件 - 验证WebSocket连接
 * 此中间件用于verifyClient机制和传统中间件模式
 */
export const authenticateWebSocket = async (
  request: IncomingMessage,
  ws?: WebSocket | null,
  next?: (err?: Error) => void
): Promise<boolean> => {
  try {
    // 从查询参数或头部获取认证信息
    const token = request.url ? extractTokenFromUrl(request.url) : null;
    
    if (!token) {
      logger.warn('WebSocket connection attempt without token');
      // 如果提供了WebSocket实例，则关闭连接
      if (ws) {
        ws.close(4001, 'Authentication token required');
      }
      // 如果提供了next回调，则调用它
      if (next) {
        next(new Error('Authentication token required'));
      }
      return false;
    }

    // 验证token
    const userId = await validateToken(token);
    
    if (!userId) {
      logger.warn('WebSocket connection attempt with invalid token');
      // 如果提供了WebSocket实例，则关闭连接
      if (ws) {
        ws.close(4002, 'Invalid authentication token');
      }
      // 如果提供了next回调，则调用它
      if (next) {
        next(new Error('Invalid authentication token'));
      }
      return false;
    }
    
    // 如果提供了next回调，则调用它
    if (next) {
      next();
    }
    
    return true;
  } catch (error) {
    logger.error('WebSocket authentication error:', error);
    // 如果提供了WebSocket实例，则关闭连接
    if (ws) {
      ws.close(4003, 'Authentication error');
    }
    // 如果提供了next回调，则调用它
    if (next) {
      next(error instanceof Error ? error : new Error(String(error)));
    }
    return false;
  }
};

// 从URL中提取token的辅助函数
const extractTokenFromUrl = (url: string): string | null => {
  try {
    const parsedUrl = new URL(url, `http://localhost`);
    return parsedUrl.searchParams.get('token');
  } catch (error) {
    logger.error('Error parsing WebSocket URL:', error);
    return null;
  }
};

// 验证token的辅助函数 - 实现实际的JWT验证逻辑
const validateToken = async (token: string): Promise<string | null> => {
  try {
    // 导入JWT库进行验证
    const jwt = await import('jsonwebtoken');
    const secret = process.env.JWT_SECRET || 'your-secret-key';
    
    // 验证JWT token
    const decoded = jwt.default.verify(token, secret) as { id: string; iat: number; exp: number };
    
    // 返回用户ID
    return decoded.id.toString();
  } catch (error) {
    logger.error('Token validation error:', error);
    return null;
  }
};