import { logger } from './logger';

export class CacheLogger {
  static logOperation(operation: string, key: string, success: boolean, duration?: number) {
    const message = `Cache ${operation} - Key: ${key}, Success: ${success}, Duration: ${duration}ms`;
    console.log(message);
    logger.debug(message);
  }
}