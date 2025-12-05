import { RedisCacheService } from '../services/cache.service';
import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { createHash } from 'crypto';

export class CacheQueryMiddleware {

  private hashCache = new Map<string, string>();
  private pathCache = new Map<string, boolean>();

  constructor(private readonly cacheService: RedisCacheService) {
    this.pathCache.set('/api/v1/product/list', false);
    this.pathCache.set('/api/v1/notifications/unread/count', true);
  }

  // 创建工厂函数，以便在需要时注入服务
  static create(cacheService: RedisCacheService) {
    return new CacheQueryMiddleware(cacheService).middleware;
  }

  private middleware = async (req: Request, res: Response, next: NextFunction) => {
    // 只缓存GET请求
    if (req.method !== 'GET' || !this.pathCache.has(req.path)) {
      return next();
    }
    // 生成缓存key
    const cacheKey = this.generateCacheKey(req);
    
    try {
      // 尝试从缓存获取数据
      const cachedData = await this.cacheService.get(cacheKey);
      
      if (cachedData) {
        // 如果有缓存数据，直接返回
        console.log('Cache hit:', cacheKey);
        return res.json(cachedData);
      }
      
      // 如果没有缓存数据，包装原始响应方法
      const originalJson = res.json;
      
      res.json = (data) => {
        // 将响应数据存入缓存
        console.log('Cache set:', cacheKey);
        this.cacheService.set(cacheKey, data).catch(err => {
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

  private generateCacheKey(req: Request) {
    const { path, method, query } = req;

    const authHeader = req.headers.authorization;
    let user = 'nobody';
    if (this.pathCache.get(req.path) && authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const payload = jwt.decode(token) as { id: string };
      user = payload?.id || 'nobody';
    }
    return `api:${method}:${path}:${this.md5Hash(JSON.stringify(query))}:${user}`;
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