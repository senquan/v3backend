import { Request, Response, NextFunction } from 'express';
import { RedisCacheService } from '../services/cache.service';

// 获取缓存服务实例
const cacheService = new RedisCacheService();

/**
 * 缓存清除中间件
 * 在数据变更操作后清除相关缓存
 */
export function cacheClearMiddleware(pattern: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // 先执行下一个中间件或路由处理器
      await next();
      // 如果响应成功，清除相关缓存
      if (res.statusCode >= 200 && res.statusCode < 300) {
        await clearCacheByPath(pattern);
      }
    } catch (error) {
      console.warn('缓存清除中间件错误:', error);
      // 即使缓存清除失败，也不影响主要业务逻辑
      next(error);
    }
  };
}

/**
 * 根据路径清除缓存
 * @param path 缓存路径
 */
export async function clearCacheByPath(path: string): Promise<void> {
  await cacheService.clearCacheByPath(path);
}

/**
 * 清除通知相关缓存
 */
export async function clearNotificationCache(): Promise<void> {
  await cacheService.clearCacheByPath('/api/notifications');
}