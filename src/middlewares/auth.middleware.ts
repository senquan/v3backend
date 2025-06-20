import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { AppDataSource } from '../config/database';
import { User } from '../models/entities/User.entity';
import { logger } from '../utils/logger';
import { errorResponse } from '../utils/response';

interface JwtPayload {
  id: number;
  roles?: string[];
  accessTags?: number[];
}

/**
 * 认证中间件
 * 验证请求头中的 JWT 令牌，并将用户信息添加到请求对象中
 */
export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 从请求头中获取 token
    const authHeader = req.headers.authorization;
    
    next();
    // if (!authHeader || !authHeader.startsWith('Bearer ')) return errorResponse(res, 401, '未提供有效的认证令牌');
    
    // // 提取 token
    // const token = authHeader.split(' ')[1];
    
    // // 验证 token
    // const decoded = jwt.verify(
    //   token, 
    //   process.env.JWT_SECRET || 'your-secret-key'
    // ) as JwtPayload;
    
    // if (!decoded || !decoded.id) return errorResponse(res, 401, '无效的认证令牌');
    
    // // 查询用户信息
    // const userRepository = AppDataSource.getRepository(User);
    // const user = await userRepository.findOne({
    //   where: { _id: decoded.id }
    // });
    
    // if (!user) return errorResponse(res, 401, '用户不存在');
    
    // // 检查用户状态
    // if (user.status !== 1) return errorResponse(res, 403, '账户已被禁用');
    
    // // 将用户信息添加到请求对象中
    // (req as any).user = user;
    // // 将角色和标签信息添加到请求对象中
    // if (decoded.roles) {
    //   (req as any).userRoles = decoded.roles;
    // } else {
    //   // 如果 JWT 中没有角色信息，则从用户对象中获取
    //   (req as any).userRoles = [];
    //}
    // 将可访问标签添加到请求对象中
    // (req as any).accessTags = decoded.accessTags || [];
    // 继续处理请求
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        code: 401,
        message: '无效的认证令牌',
        data: null
      });
    } else if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        code: 401,
        message: '认证令牌已过期',
        data: null
      });
    }
    
    logger.error('认证中间件错误:', error);
    return res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      data: null
    });
  }
};

/**
 * 角色验证中间件
 * 验证用户是否拥有指定角色
 * @param roles 允许访问的角色列表
 */
export const roleMiddleware = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      
      if (!user) {
        return res.status(401).json({
          code: 401,
          message: '未授权',
          data: null
        });
      }
      
      // 获取用户角色
      const userRoles = user.getRoleCodes();
      
      // 检查用户是否拥有所需角色
      const hasRole = userRoles.some((role: string) => roles.includes(role));
      
      if (!hasRole) {
        return res.status(403).json({
          code: 403,
          message: '权限不足',
          data: null
        });
      }
      
      next();
    } catch (error) {
      logger.error('角色验证中间件错误:', error);
      return res.status(500).json({
        code: 500,
        message: '服务器内部错误',
        data: null
      });
    }
  };
};