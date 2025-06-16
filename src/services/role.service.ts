import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../models/role.model';
import { RolePermission } from '../models/role-permission.model';
import { AppDataSource } from '../config/database';

@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(Role)
    private roleRepository = AppDataSource.getRepository(Role),
    @InjectRepository(RolePermission)
    private rolePermissionRepository = AppDataSource.getRepository(RolePermission),
  ) {}

  /**
   * 获取所有角色
   */
  async findAll(): Promise<Role[]> {
    return this.roleRepository.find();
  }

  /**
   * 根据ID获取角色
   * @param id 角色ID
   */
  async findById(id: number): Promise<Role | null> {
    return this.roleRepository.findOne({ where: { id } });
  }

  /**
   * 创建角色
   * @param role 角色信息
   */
  async create(role: Partial<Role>): Promise<Role> {
    const newRole = this.roleRepository.create(role);
    return this.roleRepository.save(newRole);
  }

  /**
   * 更新角色
   * @param id 角色ID
   * @param role 角色信息
   */
  async update(id: number, role: Partial<Role>): Promise<Role | null> {
    await this.roleRepository.update(id, role);
    return this.findById(id);
  }

  /**
   * 删除角色
   * @param id 角色ID
   */
  async delete(id: number): Promise<void> {
    await this.roleRepository.delete(id);
  }

  /**
   * 获取角色权限
   * @param roleId 角色ID
   */
  async getRolePermissions(roleId: number): Promise<number[]> {
    const rolePermissions = await this.rolePermissionRepository.find({
      where: { roleId: roleId },
    });
    return rolePermissions.map(rp => rp.permissionId);
  }

  /**
   * 设置角色权限
   * @param roleId 角色ID
   * @param permissionIds 权限ID数组
   */
  async setRolePermissions(roleId: number, permissionIds: number[]): Promise<void> {
    // 开启事务
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 删除原有权限
      await queryRunner.manager.delete(RolePermission, { role_id: roleId });

      // 添加新权限
      const rolePermissions = permissionIds.map(permissionId => {
        const rolePermission = new RolePermission();
        rolePermission.roleId = roleId;
        rolePermission.permissionId = permissionId;
        return rolePermission;
      });

      await queryRunner.manager.save(rolePermissions);

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
}