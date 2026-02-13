import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In } from 'typeorm';
import { UserRole } from '../models/user-roles.entity';
import { RolePermission } from '../models/role-permission.entity';
import { Permission } from '../models/permission.entity';
import { AppDataSource } from '../config/database';

@Injectable()
export class UserPermissionService {
  constructor(
    @InjectRepository(UserRole)
    private userRoleRepository = AppDataSource.getRepository(UserRole),
    @InjectRepository(RolePermission)
    private rolePermissionRepository = AppDataSource.getRepository(RolePermission),
    @InjectRepository(Permission)
    private permissionRepository = AppDataSource.getRepository(Permission),
  ) {}

  /**
   * 获取用户角色
   * @param userId 用户ID
   */
  async getUserRoles(userId: number): Promise<number[]> {
    const userRoles = await this.userRoleRepository.find({
      where: { userId: userId },
    });
    return userRoles.map(ur => ur.roleId);
  }

  /**
   * 设置用户角色
   * @param userId 用户ID
   * @param roleIds 角色ID数组
   */
  async setUserRoles(userId: number, roleIds: number[]): Promise<void> {
    // 开启事务
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 删除原有角色
      await queryRunner.manager.delete(UserRole, { user_id: userId });

      // 添加新角色
      const userRoles = roleIds.map(roleId => {
        const userRole = new UserRole();
        userRole.userId = userId;
        userRole.roleId = roleId;
        return userRole;
      });

      await queryRunner.manager.save(userRoles);

      // 提交事务
      await queryRunner.commitTransaction();
    } catch (error) {
      // 回滚事务
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      // 释放查询运行器
      await queryRunner.release();
    }
  }

  /**
   * 获取用户权限
   * @param userId 用户ID
   */
  async getUserPermissions(userId: number): Promise<Permission[]> {
    // 获取用户角色
    const userRoles = await this.userRoleRepository.find({
      where: { userId: userId },
    });
    
    if (userRoles.length === 0) {
      return [];
    }

    const roleIds = userRoles.map(ur => ur.roleId);

    // 获取角色权限
    const rolePermissions = await this.rolePermissionRepository.find({
      where: { roleId: In(roleIds) },
    });

    if (rolePermissions.length === 0) {
      return [];
    }

    const permissionIds = [...new Set(rolePermissions.map(rp => rp.permissionId))];

    // 获取权限详情
    const permissions = await this.permissionRepository.find({
      where: { id: In(permissionIds), status: 1 },
    });

    return permissions;
  }

  /**
   * 获取用户菜单
   * @param userId 用户ID
   */
  async getUserMenus(userId: number): Promise<Permission[]> {
    const permissions = await this.getUserPermissions(userId);
    
    // 过滤出菜单类型的权限
    const menuPermissions = permissions.filter(p => p.type === 1);
    
    // 构建菜单树
    return this.buildPermissionTree(menuPermissions);
  }

  /**
   * 构建权限树
   * @param permissions 权限列表
   */
  private buildPermissionTree(permissions: Permission[]): Permission[] {
    // 创建一个映射表
    const permissionMap = new Map<number, Permission>();
    permissions.forEach(permission => {
      permissionMap.set(permission.id, { ...permission, children: [] });
    });
    
    const tree: Permission[] = [];
    
    // 构建树结构
    permissions.forEach(permission => {
      const node = permissionMap.get(permission.id);
      if (node) {
        if (permission.parentId === null || permission.parentId === 0) {
          // 根节点
          tree.push(node);
        } else {
          // 子节点
          const parent = permissionMap.get(permission.parentId);
          if (parent) {
            parent.children = parent.children || [];
            parent.children.push(node);
          }
        }
      }
    });
    
    return tree;
  }
}