import { SetMetadata } from '@nestjs/common';
import { LogCategory } from '../models/system-log.model';

export const LOG_CATEGORY_KEY = 'log:category';
export const LogCategoryDecorator = (category: LogCategory) =>
  SetMetadata(LOG_CATEGORY_KEY, category);

export const LOG_ACTION_KEY = 'log:action';
export const LogActionDecorator = (action: string) =>
  SetMetadata(LOG_ACTION_KEY, action);

export const LOG_RESOURCE_KEY = 'log:resource';
export const LogResourceDecorator = (resource: string) =>
  SetMetadata(LOG_RESOURCE_KEY, resource);

export const LOG_LEVEL_KEY = 'log:level';
export const LogLevelDecorator = (level: string) =>
  SetMetadata(LOG_LEVEL_KEY, level);

import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const TraceId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.traceId || request.headers['x-trace-id'];
  },
);

export const SpanId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.spanId;
  },
);

export const UserId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.userId || request.body?.userId;
  },
);

export const UserName = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.userName || request.body?.userName;
  },
);

export const RequestIp = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.ip || request.headers['x-forwarded-for'] || request.connection?.remoteAddress;
  },
);
