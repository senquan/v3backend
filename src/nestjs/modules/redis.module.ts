import { Module, Global } from '@nestjs/common';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: () => {
        const client = new Redis(
          parseInt(process.env.REDIS_PORT || '6379', 10),
          process.env.REDIS_HOST || 'localhost',
          {
            maxRetriesPerRequest: 3,
            lazyConnect: true,
            enableReadyCheck: true,
          },
        );

        client.on('connect', () => {
          console.log('Redis connected (NestJS)');
        });

        client.on('error', (err) => {
          console.error('Redis error:', err);
        });

        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
