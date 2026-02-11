import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

// 创建数据源
export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || 'password',
  database: process.env.DB_NAME || 'cardbug',
  synchronize: process.env.NODE_ENV !== 'production', // 开发环境自动同步数据库结构
  logging: process.env.NODE_ENV !== 'production',
  entities: [],
  migrations: [__dirname + '/../migrations/**/*.ts'],
  subscribers: [__dirname + '/../subscribers/**/*.ts'],
});