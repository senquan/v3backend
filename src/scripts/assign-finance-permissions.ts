import * as dotenv from 'dotenv';
import { AppDataSource } from '../config/database';
import { Role } from '../models/role.entity';
import { Permission } from '../models/permission.entity';
import { RolePermission } from '../models/role-permission.entity';

// 加载环境变量
dotenv.config();

async function assignFinancePermissionsToAdmin() {
  try {
    // 初始化数据库连接
    await AppDataSource.initialize();
    console.log('数据库连接成功');

    const roleRepository = AppDataSource.getRepository(Role);
    const permissionRepository = AppDataSource.getRepository(Permission);
    const rolePermissionRepository = AppDataSource.getRepository(RolePermission);

    // 查找管理员角色
    const adminRole = await roleRepository.findOne({
      where: { code: 'ADMIN' }
    });

    if (!adminRole) {
      console.log('未找到管理员角色');
      return;
    }

    console.log(`找到管理员角色: ${adminRole.name} (ID: ${adminRole.id})`);

    // 查找所有财务权限
    const financePermissions = await permissionRepository
      .createQueryBuilder('permission')
      .where('permission.code LIKE :code', { code: 'finance%' })
      .getMany();

    if (financePermissions.length === 0) {
      console.log('未找到财务权限');
      return;
    }

    console.log(`找到 ${financePermissions.length} 个财务权限`);

    // 为每个权限创建角色权限关联
    for (const permission of financePermissions) {
      // 检查是否已存在关联
      const existingRolePermission = await rolePermissionRepository.findOne({
        where: {
          roleId: adminRole.id,
          permissionId: permission.id
        }
      });

      if (!existingRolePermission) {
        const rolePermission = rolePermissionRepository.create({
          roleId: adminRole.id,
          permissionId: permission.id
        });
        
        await rolePermissionRepository.save(rolePermission);
        console.log(`已为管理员分配权限: ${permission.name} (${permission.code})`);
      } else {
        console.log(`权限已存在: ${permission.name} (${permission.code})`);
      }
    }

    console.log('所有财务权限已成功分配给管理员角色');

  } catch (error) {
    console.error('分配权限失败:', error);
  } finally {
    await AppDataSource.destroy();
  }
}

// 执行分配
assignFinancePermissionsToAdmin();