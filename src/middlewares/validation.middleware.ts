import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { errorResponse } from '../utils/response';
import { logger } from '../utils/logger';

/**
 * 验证请求中间件
 * 处理 express-validator 的验证结果
 */
export function validateRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(error => ({
        field: error.type === 'field' ? error.path : 'unknown',
        message: error.msg,
        value: error.type === 'field' ? error.value : undefined
      }));
      
      logger.warn('请求验证失败:', {
        url: req.url,
        method: req.method,
        errors: errorMessages,
        body: req.body,
        query: req.query,
        params: req.params
      });
      
      return errorResponse(res, 400, `请求参数验证失败: ${errorMessages}`);
    }
    
    next();
  } catch (error) {
    logger.error('验证中间件错误:', error);
    return errorResponse(res, 500, '服务器内部错误');
  }
}

/**
 * 自定义验证器：检查日期范围
 * @param startDate 开始日期
 * @param endDate 结束日期
 * @returns 验证结果
 */
export function validateDateRange(startDate: string, endDate: string): boolean {
  if (!startDate || !endDate) {
    return true; // 如果其中一个为空，则不进行范围验证
  }
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  return start <= end;
}

/**
 * 自定义验证器：检查时间是否为未来时间
 * @param dateTime 日期时间字符串
 * @returns 验证结果
 */
export function validateFutureDate(dateTime: string): boolean {
  if (!dateTime) {
    return true; // 如果为空，则不进行验证
  }
  
  const date = new Date(dateTime);
  const now = new Date();
  
  return date > now;
}

/**
 * 自定义验证器：检查数组中的元素是否唯一
 * @param array 要检查的数组
 * @param keyField 用于比较的字段名（可选）
 * @returns 验证结果
 */
export function validateUniqueArray(array: any[], keyField?: string): boolean {
  if (!Array.isArray(array)) {
    return false;
  }
  
  if (keyField) {
    const values = array.map(item => item[keyField]);
    return new Set(values).size === values.length;
  } else {
    return new Set(array).size === array.length;
  }
}

/**
 * 自定义验证器：检查文件大小
 * @param file 文件对象
 * @param maxSizeInMB 最大文件大小（MB）
 * @returns 验证结果
 */
export function validateFileSize(file: any, maxSizeInMB: number): boolean {
  if (!file || !file.size) {
    return true; // 如果没有文件，则不进行验证
  }
  
  const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
  return file.size <= maxSizeInBytes;
}

/**
 * 自定义验证器：检查文件类型
 * @param file 文件对象
 * @param allowedTypes 允许的文件类型数组
 * @returns 验证结果
 */
export function validateFileType(file: any, allowedTypes: string[]): boolean {
  if (!file || !file.mimetype) {
    return true; // 如果没有文件，则不进行验证
  }
  
  return allowedTypes.includes(file.mimetype);
}

/**
 * 自定义验证器：检查密码强度
 * @param password 密码
 * @returns 验证结果
 */
export function validatePasswordStrength(password: string): boolean {
  if (!password) {
    return false;
  }
  
  // 密码必须包含至少8个字符，包括大小写字母、数字和特殊字符
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
}

/**
 * 自定义验证器：检查手机号格式
 * @param phone 手机号
 * @returns 验证结果
 */
export function validatePhoneNumber(phone: string): boolean {
  if (!phone) {
    return true; // 如果为空，则不进行验证
  }
  
  // 中国大陆手机号格式
  const phoneRegex = /^1[3-9]\d{9}$/;
  return phoneRegex.test(phone);
}

/**
 * 自定义验证器：检查邮箱格式
 * @param email 邮箱地址
 * @returns 验证结果
 */
export function validateEmail(email: string): boolean {
  if (!email) {
    return true; // 如果为空，则不进行验证
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * 自定义验证器：检查身份证号格式
 * @param idCard 身份证号
 * @returns 验证结果
 */
export function validateIdCard(idCard: string): boolean {
  if (!idCard) {
    return true; // 如果为空，则不进行验证
  }
  
  // 18位身份证号格式
  const idCardRegex = /^[1-9]\d{5}(18|19|20)\d{2}((0[1-9])|(1[0-2]))(([0-2][1-9])|10|20|30|31)\d{3}[0-9Xx]$/;
  return idCardRegex.test(idCard);
}

export default {
  validateRequest,
  validateDateRange,
  validateFutureDate,
  validateUniqueArray,
  validateFileSize,
  validateFileType,
  validatePasswordStrength,
  validatePhoneNumber,
  validateEmail,
  validateIdCard
};