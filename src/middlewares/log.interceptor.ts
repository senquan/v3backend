import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { LogService } from '../services/log.service';
import { LogLevel, LogCategory } from '../models/system-log.model';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class LogInterceptor implements NestInterceptor {
  constructor(private logService: LogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const contextType = context.getType();
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const traceId = request.headers['x-trace-id'] || uuidv4();
    const spanId = uuidv4().substring(0, 8);
    const startTime = Date.now();

    request.traceId = traceId;
    request.spanId = spanId;

    const { method, url, ip, headers } = request;
    const userAgent = headers['user-agent'] || '';
    const userId = request.user?.userId || request.body?.userId || undefined;
    const userName = request.user?.userName || undefined;

    return next.handle().pipe(
      tap({
        next: (data) => {
          const duration = Date.now() - startTime;
          const statusCode = response.statusCode;

          this.logService.log({
            level: statusCode >= 500 ? LogLevel.ERROR : statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO,
            category: LogCategory.API,
            message: `${method} ${url} ${statusCode}`,
            context: { response: data },
            traceId,
            spanId,
            userId,
            userName,
            ip,
            userAgent,
            action: method,
            resource: url,
            duration,
            requestId: request.headers['x-request-id'],
            correlationId: request.headers['x-correlation-id'],
            metadata: {
              statusCode,
              responseTime: `${duration}ms`,
            },
          });
        },
        error: (error) => {
          const duration = Date.now() - startTime;

          this.logService.error(
            `${method} ${url} Error: ${error.message}`,
            error.stack,
            {
              traceId,
              spanId,
              userId,
              userName,
              ip,
              userAgent,
              action: method,
              resource: url,
              duration,
              statusCode: error.status || 500,
            },
            LogCategory.API,
          );
        },
      }),
    );
  }
}

@Injectable()
export class BusinessLogInterceptor implements NestInterceptor {
  constructor(private logService: LogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    const traceId = request.traceId || uuidv4();
    const spanId = uuidv4().substring(0, 8);
    const startTime = Date.now();

    const { method, url, ip, headers, user, body } = request;
    const userAgent = headers['user-agent'] || '';
    const userId = user?.userId || body?.userId || undefined;
    const userName = user?.userName || body?.userName || undefined;

    const resource = body?.resource || request.route?.path || url;
    const action = body?.action || `${method} ${resource}`;

    return next.handle().pipe(
      tap({
        next: (data) => {
          const duration = Date.now() - startTime;

          this.logService.info(
            `Business action completed: ${action}`,
            { request: body, response: data },
            LogCategory.BUSINESS,
          );
        },
        error: (error) => {
          const duration = Date.now() - startTime;

          this.logService.error(
            `Business action failed: ${action}`,
            error.stack,
            { request: body, error: error.message },
            LogCategory.BUSINESS,
          );
        },
      }),
    );
  }
}
