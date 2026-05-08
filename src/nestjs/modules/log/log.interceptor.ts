import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { LogService } from './log.service';
import { LogLevel, LogCategory } from '../../../models/system-log.model';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class LogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LogInterceptor.name);

  constructor(private logService: LogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const { method, url, ip, headers } = request;
    const userAgent = headers['user-agent'] || '';
    const startTime = Date.now();
    const traceId = uuidv4();
    const spanId = uuidv4().substring(0, 8);

    request.traceId = traceId;
    request.spanId = spanId;

    const userId = request.user?.id?.toString();
    const userName = request.user?.name;

    return next.handle().pipe(
      tap({
        next: (data) => {
          const duration = Date.now() - startTime;
          const statusCode = response.statusCode;

          this.logService.log({
            level: statusCode >= 500 ? LogLevel.ERROR : statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO,
            category: LogCategory.API,
            message: `${method} ${url} ${statusCode}`,
            traceId,
            spanId,
            userId,
            userName,
            ip,
            userAgent,
            action: method,
            resource: url,
            duration,
            requestId: headers['x-request-id'],
            correlationId: headers['x-correlation-id'],
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
            },
            LogCategory.API,
          );
        },
      }),
    );
  }
}
