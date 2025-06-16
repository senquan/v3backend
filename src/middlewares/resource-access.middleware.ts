import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { errorResponse } from '../utils/response';

/**
 * 资源访问中间件
 * 检查用户是否有权访问特定标签的资源
 * @param requiredTags 资源所需的标签ID数组，如果为空则表示不需要特定标签
 */
export const resourceAccessMiddleware = (requiredTags: number[] = []) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // 如果资源没有标签要求，则允许访问
      if (!requiredTags.length) {
        return next();
      }
      
      const accessTags = (req as any).accessTags || [];
      
      // 检查用户是否有权访问至少一个所需标签
      const hasAccess = requiredTags.some(tagId => accessTags.includes(tagId));
      
      if (!hasAccess) return errorResponse(res, 403, '没有访问该资源的权限');
      
      next();
    } catch (error) {
      logger.error('资源访问中间件错误:', error);
      return errorResponse(res, 500, '服务器内部错误');
    }
  };
};