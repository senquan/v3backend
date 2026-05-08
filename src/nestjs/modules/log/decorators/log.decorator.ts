import { SetMetadata } from '@nestjs/common';
import { LogCategory } from '../../../../models/system-log.model';

export const LOG_CATEGORY_KEY = 'log:category';
export const LogCategoryDecorator = (category: LogCategory) =>
  SetMetadata(LOG_CATEGORY_KEY, category);

export const LOG_ACTION_KEY = 'log:action';
export const LogActionDecorator = (action: string) =>
  SetMetadata(LOG_ACTION_KEY, action);

export const LOG_RESOURCE_KEY = 'log:resource';
export const LogResourceDecorator = (resource: string) =>
  SetMetadata(LOG_RESOURCE_KEY, resource);
