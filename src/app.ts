import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import routes from './routes/index';
import { AppDataSource } from './config/database';
import { errorMiddleware } from './middlewares/error.middleware';
import { logger } from './utils/logger';
import path from 'path';
import { RedisCacheService } from './services/cache.service';
import { CacheQueryMiddleware } from './middlewares/cache-query.middleware';

// 加载环境变量
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;
const redisCacheService = new RedisCacheService();

// 中间件

// 创建缓存中间件
const cacheMiddleware = CacheQueryMiddleware.create(redisCacheService);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use(cacheMiddleware);

// 配置静态文件服务
const uploadPath = process.env.UPLOAD_PATH || './uploads';
app.use('/uploads', express.static(path.join(__dirname, '..', uploadPath)));

// 数据库连接
AppDataSource.initialize()
  .then(() => {
    logger.info('Database connection established');
  })
  .catch((error) => {
    logger.error('Error connecting to database:', error);
  });

// 路由
app.use('/api', routes);

// 错误处理中间件
app.use(errorMiddleware);

// 启动服务器
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

export default app;