import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

import { CompanyInfo } from '../models/company-info.entity';
import { InviteCode } from '../models/invite-code.entity';
import { Permission } from '../models/permission.entity';
import { Role } from '../models/role.entity';
import { RolePermission } from '../models/role-permission.entity';
import { User } from '../models/user.entity';
import { UserRole } from '../models/user-roles.entity';

// 加载环境变量
dotenv.config();

// 创建数据源
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'password',
  database: process.env.DB_NAME || 'training',
  schema: process.env.DB_SCHEMA || 'fms',
  synchronize: process.env.NODE_ENV !== 'production', // 开发环境自动同步数据库结构
  logging: process.env.NODE_ENV !== 'production',
  entities: [CompanyInfo, InviteCode, Permission, Role, RolePermission, User, UserRole],
  migrations: [__dirname + '/../migrations/**/*.ts'],
  subscribers: [__dirname + '/../subscribers/**/*.ts'],
});