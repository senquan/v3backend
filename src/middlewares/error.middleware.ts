import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { errorResponse } from '../utils/response';

export const errorMiddleware = (err: Error, req: Request, res: Response, next: NextFunction): void => {
  logger.error(`Error: ${err.message}`);
  logger.error(err.stack || '');
  
  errorResponse(res, 500, '服务器内部错误');
};