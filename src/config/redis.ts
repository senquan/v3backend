import Redis from 'ioredis';

export const redisClient = new Redis(
    parseInt(process.env.REDIS_PORT || '6379', 10),
    process.env.REDIS_HOST || 'localhost',
    {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        enableReadyCheck: true,
    }
);

redisClient.on('connect', () => {
  console.log('Redis connected');
});

redisClient.on('error', (err) => {
  console.error('Redis error:', err);
});