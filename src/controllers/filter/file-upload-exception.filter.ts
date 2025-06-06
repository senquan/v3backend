import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';
import { Response } from 'express';
import { MulterError } from 'multer';
import { Logger } from '@nestjs/common';

@Catch(HttpException, MulterError)  // 同时捕获常规HTTP异常和Multer特定错误
export class FileUploadExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(FileUploadExceptionFilter.name);
  catch(exception: HttpException | MulterError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();
    // 提取请求基本信息（用于日志记录）
    const { method, originalUrl } = request;
    const userAgent = request.get('user-agent') || '';
    // 构造基础错误响应
    let statusCode = 400;
    let errorMessage = '文件上传失败';
    // 处理不同错误类型
    if (exception instanceof MulterError) {
      // Multer错误处理
      switch (exception.code) {
        case 'LIMIT_FILE_SIZE':
          statusCode = 413;  // Payload Too Large
          errorMessage = '文件大小超过限制（最大5MB）';
          break;
        case 'LIMIT_FILE_COUNT':
          statusCode = 413;
          errorMessage = '文件数量超过限制（最多10个）';
          break;
        case 'LIMIT_UNEXPECTED_FILE':
          statusCode = 400;
          errorMessage = '文件字段名称不符合要求';
          break;
        default:
          errorMessage = `文件上传配置错误：${exception.message}`;
      }
    } else if (exception instanceof HttpException) {
      // 自定义HttpException处理（来自fileFilter等）
      statusCode = exception.getStatus();
      errorMessage = exception.message;
    }
    // 生成完整错误响应
    const errorResponse = {
      code: -1,
      message: errorMessage,
      timestamp: new Date().toISOString(),
      path: `${method} ${originalUrl}`  // 示例：POST /upload/image
    };
    // 记录警告日志（包含客户端信息）
    this.logger.warn(`[${statusCode}] ${errorMessage} - Client: ${userAgent}`);
    
    // 发送错误响应
    response.status(statusCode).json(errorResponse);
  }
}