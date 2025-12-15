import Redis from 'ioredis';
import { redisClient } from '../config/redis';
import { CacheService } from './interfaces/cache.service';
export class RedisCacheService implements CacheService {
  
  private client: Redis;
  constructor() {
    this.client = redisClient;
  }

  async get<T>(key: string): Promise<T | null> {
    return new Promise((resolve, reject) => {
      this.client.get(key, (err: any, reply: any) => {
        if (err) return reject(err);
        resolve(reply ? JSON.parse(reply) : null);
      });
    });
  }
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const serializedValue = JSON.stringify(value);
      
      if (ttl) {
        this.client.setex(key, ttl, serializedValue, (err: any) => {
          if (err) return reject(err);
          resolve();
        });
      } else {
        this.client.set(key, serializedValue, (err: any) => {
          if (err) return reject(err);
          resolve();
        });
      }
    });
  }
  async del(key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.del(key, (err: any) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }
  async exists(key: string): Promise<boolean> {
    try {
      const result = await redisClient.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`Cache EXISTS error for key ${key}:`, error);
      return false;
    }
  }
  async clearCacheByPath(path: string): Promise<void> {
    // 在Redis中使用模式匹配查找所有相关缓存
    const pattern = `api:GET:${path}*`;
    console.log('Cache clear pattern:', pattern);
    return new Promise((resolve, reject) => {
      this.client.keys(pattern, (err, keys) => {
        if (err) return reject(err);
        if (keys && keys.length > 0) {
          this.client.del(keys, (err) => {
            if (err) return reject(err);
            resolve();
          });
        } else {
          resolve();
        }
      });
    });
  }
  // 高级方法：缓存装饰器
  async remember<T>(key: string, ttl: number, callback: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }
    
    const fresh = await callback();
    await this.set(key, fresh, ttl);
    return fresh;
  }
}