import { RedisCacheService } from '../services/cache.service';
import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { createHash } from 'crypto';

interface CacheOptions {
  userOnly: boolean;
  ttl?: number;
}

export class CacheQueryMiddleware {

  private DEFAULT_TTL = 3 * 60 * 60;
  private hashCache = new Map<string, string>();
  private pathCache = new Map<string, CacheOptions>();

  constructor(private readonly cacheService: RedisCacheService) {
    this.pathCache.set('/api/v1/product/list', { userOnly: false, ttl: 60 * 60 });
    this.pathCache.set('/api/v1/notifications/unread/count', { userOnly: true });
  }

  // 创建工厂函数，以便在需要时注入服务
  static create(cacheService: RedisCacheService) {
    return new CacheQueryMiddleware(cacheService).middleware;
  }

  private middleware = async (req: Request, res: Response, next: NextFunction) => {
    const cacheOptions = this.pathCache.get(req.path);
    // 只缓存GET请求
    if (req.method !== 'GET' || !cacheOptions) {
      return next();
    }

    // 生成缓存key
    const cacheKey = this.generateCacheKey(req, cacheOptions?.userOnly);
    
    try {
      // 尝试从缓存获取数据
      const cachedData = await this.cacheService.get(cacheKey);
      
      if (cachedData) {
        // 如果有缓存数据，直接返回
        // console.log('Cache hit:', cacheKey);
        return res.json(cachedData);
      }
      
      // 如果没有缓存数据，包装原始响应方法
      const originalJson = res.json;
      
      res.json = (data) => {
        // 将响应数据存入缓存
        console.log('Cache set:', cacheKey);
        this.cacheService.set(cacheKey, data, cacheOptions.ttl || this.DEFAULT_TTL).catch(err => {
          console.error('Cache set error:', err);
        });
        
        // 调用原始的res.json方法
        return originalJson.call(res, data);
      };
      
      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      next();
    }
  };

  private generateCacheKey(req: Request, userOnly: boolean = true) {
    const { path, method, query } = req;

    const authHeader = req.headers.authorization;
    let user = 'nobody';
    
    if (userOnly && authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const payload = jwt.decode(token) as { id: string };
      user = payload?.id || 'nobody';
    }
    return `api:${method}:${path}:${this.md5Hash(JSON.stringify(query))}:u:${user}:`;
  }

  private md5Hash(data: string): string {
    if (this.hashCache.has(data)) {
      return this.hashCache.get(data)!;
    }
    
    const shortHash = createHash('md5').update(data).digest('hex').substring(0, 12);
    this.hashCache.set(data, shortHash);
    
    // 限制缓存大小防止内存泄漏
    if (this.hashCache.size > 1000) {
      this.hashCache.clear();
    }
    
    return shortHash;
  }
}