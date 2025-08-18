import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationError } from 'express-validator';
import { errorResponse } from '../utils/response';
import { logger } from '../utils/logger';

/**
 * 请求验证中间件
 * 检查express-validator的验证结果，如果有错误则返回错误响应
 */
export const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map((error: ValidationError) => ({
        type: error.type,
        message: error.msg
      }));
      
      logger.warn('请求验证失败:', {
        url: req.url,
        method: req.method,
        errors: errorMessages
      });
      
      return errorResponse(res, 400, '请求参数验证失败', {
        errors: errorMessages
      });
    }
    
    next();
  } catch (error) {
    logger.error('验证中间件执行错误:', error);
    return errorResponse(res, 500, '服务器内部错误');
  }
};

/**
 * 创建自定义验证中间件
 * @param customValidation 自定义验证函数
 * @returns 验证中间件函数
 */
export const createValidationMiddleware = (customValidation: (req: Request) => string | null) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const error = customValidation(req);
      
      if (error) {
        logger.warn('自定义验证失败:', {
          url: req.url,
          method: req.method,
          error
        });
        
        return errorResponse(res, 400, error);
      }
      
      next();
    } catch (error) {
      logger.error('自定义验证中间件执行错误:', error);
      return errorResponse(res, 500, '服务器内部错误');
    }
  };
};