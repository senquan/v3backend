import * as dotenv from 'dotenv';
import { AppDataSource } from '../config/database';
import { Role } from '../models/role.entity';

// 加载环境变量
dotenv.config();

async function createAdminRole() {
  try {
    // 初始化数据库连接
    await AppDataSource.initialize();
    console.log('数据库连接成功');

    const roleRepository = AppDataSource.getRepository(Role);

    // 检查是否已存在管理员角色
    const existingAdminRole = await roleRepository.findOne({
      where: { code: 'ADMIN' }
    });

    if (existingAdminRole) {
      console.log(`管理员角色已存在: ${existingAdminRole.name} (ID: ${existingAdminRole.id})`);
      return existingAdminRole;
    }

    // 创建管理员角色
    const adminRole = roleRepository.create({
      name: '系统管理员',
      code: 'ADMIN',
      description: '拥有系统最高权限的管理员角色',
      status: 1
    });

    const savedRole = await roleRepository.save(adminRole);
    console.log(`创建管理员角色成功: ${savedRole.name} (ID: ${savedRole.id})`);

    return savedRole;

  } catch (error) {
    console.error('创建管理员角色失败:', error);
    throw error;
  } finally {
    await AppDataSource.destroy();
  }
}

// 执行创建
createAdminRole();