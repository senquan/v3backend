import Redis from 'ioredis';
import * as dotenv from 'dotenv';

dotenv.config();

class RedisManager {
  private static instance: Redis;

  public static getInstance(): Redis {
    if (!RedisManager.instance) {
      const redisConfig = {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB || '0'),
        // 关键：增加重试策略
        retryStrategy(times: number) {
          const delay = Math.min(times * 100, 3000);
          console.log(`[Redis] 连接失败，第 ${times} 次重试将在 ${delay}ms 后开始...`);
          return delay;
        },
      };

      RedisManager.instance = new Redis(redisConfig);

      RedisManager.instance.on('connect', () => {
        console.log('[Redis] 连接成功');
      });

      RedisManager.instance.on('error', (err) => {
        console.error('[Redis] 连接错误:', err);
      });
    }
    return RedisManager.instance;
  }

  public static async disconnect(): Promise<void> {
    if (RedisManager.instance) {
      await RedisManager.instance.quit();
      console.log('[Redis] 连接已断开');
    }
  }
}

export const redisClient = RedisManager.getInstance();

// 监听应用关闭信号，实现优雅关闭
process.on('SIGINT', async () => {
  await RedisManager.disconnect();
  process.exit(0);
});