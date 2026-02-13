import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull } from 'typeorm';
import { Permission } from '../models/permission.entity';
import { AppDataSource } from '../config/database';

@Injectable()
export class PermissionService {
  constructor(
    @InjectRepository(Permission)
    private permissionRepository = AppDataSource.getRepository(Permission),
  ) {}

  /**
   * 获取所有权限
   */
  async findAll(): Promise<Permission[]> {
    return this.permissionRepository.find();
  }

  /**
   * 获取权限树
   */
  async getPermissionTree(): Promise<Permission[]> {
    const permissions = await this.permissionRepository.find({
      where: { parentId: IsNull() },
      relations: ['children'],
      order: { sort: 'ASC' },
    });
    return this.buildPermissionTree(permissions);
  }

  /**
   * 根据ID获取权限
   * @param id 权限ID
   */
  async findById(id: number): Promise<Permission> {
    const permission = await this.permissionRepository.findOne({ where: { id } });
    if (!permission) {
      throw new Error(`Permission with id ${id} not found`);
    }
    return permission;
  }

  /**
   * 创建权限
   * @param permission 权限信息
   */
  async create(permission: Partial<Permission>): Promise<Permission> {
    const newPermission = this.permissionRepository.create(permission);
    return this.permissionRepository.save(newPermission);
  }

  /**
   * 更新权限
   * @param id 权限ID
   * @param permission 权限信息
   */
  async update(id: number, permission: Partial<Permission>): Promise<Permission> {
    await this.permissionRepository.update(id, permission);
    return this.findById(id);
  }

  /**
   * 删除权限
   * @param id 权限ID
   */
  async delete(id: number): Promise<void> {
    await this.permissionRepository.delete(id);
  }

  /**
   * 构建权限树
   * @param permissions 权限列表
   */
  private buildPermissionTree(permissions: Permission[]): Permission[] {
    const tree: Permission[] = [];
    permissions.forEach(permission => {
      if (permission.children && permission.children.length > 0) {
        permission.children = this.buildPermissionTree(permission.children);
      }
      tree.push(permission);
    });
    return tree;
  }
}