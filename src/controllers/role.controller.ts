import { Request, Response } from 'express';
import { In } from "typeorm";
import { AppDataSource } from '../config/database';
import { Role } from '../models/role.model';
import { RoleTags } from '../models/role-tags.model';
import { Tag } from '../models/tag.model';
import { Permission } from '../models/permission.model';
import { RolePermission } from '../models/role-permission.model';
import { logger } from '../utils/logger';
import { errorResponse, successResponse } from '../utils/response';
import { PermissionService } from '../services/permission.service';

export class RoleController {
  
  constructor(private readonly permissionService: PermissionService = new PermissionService()) {}

  // 创建角色
  async create(req: Request, res: Response): Promise<Response> {
    try {
      const { name, code, description } = req.body;

      // 验证必要字段
      if (!name || !code) {
        return errorResponse(res, 400, '角色名称和编码不能为空', null);
      }

      // 检查角色编码是否已存在
      const existingRole = await AppDataSource.getRepository(Role).findOne({
        where: { code }
      });

      if (existingRole) {
        return errorResponse(res, 400, '角色编码已存在', null);
      }

      // 创建角色
      const role = new Role();
      role.name = name;
      role.code = code;
      role.description = description || '';

      // 保存角色
      const savedRole = await AppDataSource.getRepository(Role).save(role);
      
      return successResponse(res, savedRole, '创建角色成功');

    } catch (error) {
      logger.error('创建角色失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 获取角色列表
  async getList(req: Request, res: Response): Promise<Response> {
    try {
      const { page = 1, pageSize=20, status } = req.query;
      
      const queryBuilder = AppDataSource.getRepository(Role)
        .createQueryBuilder('role')
        .where('role.isDeleted = 0');

      // 添加查询条件
      if (status !== undefined) {
        queryBuilder.where('role.status = :status', { status });
      }

      const pageNum = Number(page);
      const pageSizeNum = Number(pageSize);

      // 查询
      const [roles, total] = await queryBuilder
        .orderBy('role.id', 'ASC')
        .skip((pageNum - 1) * pageSizeNum)
        .take(pageSizeNum)
        .getManyAndCount();

      return successResponse(res, {
        roles,
        total,
        page: pageNum,
        pageSize: pageSizeNum
      }, '获取角色列表成功');

    } catch (error) {
      logger.error('获取角色列表失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 获取角色详情
  async getDetail(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      
      const role = await AppDataSource.getRepository(Role).findOne({
        where: { id: Number(id) }
      });

      if (!role) {
        return errorResponse(res, 404, '角色不存在', null);
      }

      return successResponse(res, role, '获取角色详情成功');
    } catch (error) {
      logger.error('获取角色详情失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 更新角色
  async update(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { name, code, description, status } = req.body;

      // 查找角色
      const role = await AppDataSource.getRepository(Role).findOne({
        where: { id: Number(id) }
      });

      if (!role) {
        return errorResponse(res, 404, '角色不存在', null);
      }

      // 更新角色信息
      if (name) role.name = name;
      if (code) role.code = code;
      if (description !== undefined) role.description = description;
      if (status !== undefined) role.status = status;

      // 保存角色更新
      const updatedRole = await AppDataSource.getRepository(Role).save(role);
      
      return successResponse(res, updatedRole, '更新角色成功');

    } catch (error) {
      logger.error('更新角色失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 删除角色
  async delete(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      
      const roleRepository = AppDataSource.getRepository(Role);
      // 检查商品是否存在
      const role = await roleRepository.findOne({
        where: { id: Number(id), isDeleted: 0 }
      });
      
      if (!role) return errorResponse(res, 404, '角色不存在', null);
      
      // 软删除商品
      role.isDeleted = 1;
      role.updatedAt = new Date();
      
      await roleRepository.save(role);
      return successResponse(res, null, '删除角色成功');
    } catch (error) {
      logger.error('删除角色失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 更新角色状态
  async updateStatus(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (status === undefined) {
        return errorResponse(res, 400, '状态不能为空', null);
      }

      // 更新角色状态
      const result = await AppDataSource.getRepository(Role)
        .update({ id: Number(id) }, { status });

      if (result.affected === 0) {
        return errorResponse(res, 404, '角色不存在', null);
      }

      return successResponse(res, null, '更新角色状态成功');
    } catch (error) {
      logger.error('更新角色状态失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 获取角色的资源标签列表
  async getTags(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;

      // 查找角色
      const role = await AppDataSource.getRepository(Role).findOne({
        where: { id: Number(id) },
        relations: ['tags']
      });

      if (!role) {
        return errorResponse(res, 404, '角色不存在', null);
      }

      // 查询角色及其关联的资源标签
      const [ tags, total ] = await AppDataSource.getRepository(Tag)
       .createQueryBuilder('tag')
       .getManyAndCount();

      return successResponse(res, {
        tags: role.tags,
        allTags: tags,
        total
      }, '获取角色资源标签列表成功');

    } catch (error) {
      logger.error('获取角色资源标签列表失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 更新角色的资源标签
  async updateTags(req: Request, res: Response): Promise<Response> {
    try {
      const id = req.params.id;
      const { tags } = req.body;

      const roleRepository = AppDataSource.getRepository(Role);
      const role = await roleRepository.createQueryBuilder("role")
      .leftJoinAndSelect('role.tags','tags')
      .where("role.id = :id", { id: id })
      .getOne();

      if (!role) return errorResponse(res, 404, '角色不存在', null);

      const oldTags = role.tags?.map(tag => tag.id) || []
      const newTags = tags.filter((tag: any) => typeof tag === "number")
   
      // 只有当标签发生变化时才更新
      if (JSON.stringify([...oldTags].sort()) !== JSON.stringify([...newTags].sort())) {

        const tagRepository = AppDataSource.getRepository(Tag);
        const tagEntities = await tagRepository.find({
          where: {
            id: In(newTags)
          }
        })
        
        role.tags = tagEntities
        
        // 删除旧的关联关系
        const roleTagsRepository = AppDataSource.getRepository(RoleTags);
        await roleTagsRepository.delete({
          roleId: role.id
        })
        
        // 创建新的关联关系
        const tagsRelations = newTags.map((tagId: number) => ({
          roleId: role.id,
          tagId
        }))
        
        await roleTagsRepository.insert(tagsRelations)
      }

      await roleRepository.save(role);
      return successResponse(res, null, '角色标签更新成功');
    } catch (error) {
      logger.error('更新角色标签失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  async getPermissions(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;

      // 查找角色
      const role = await AppDataSource.getRepository(Role).findOne({
        where: { id: Number(id) },
        relations: ['rolePermissions']
      });

      if (!role) {
        return errorResponse(res, 404, '角色不存在', null);
      }

      // 查询角色及其关联的资源标签
      const permissions = await this.permissionService.getPermissionTree()

      return successResponse(res, {
        permissions: role.rolePermissions.map(rp => rp.permissionId),
        allPermissions: permissions
      }, '获取角色系统权限列表成功');

    } catch (error) {
      logger.error('获取角色系统权限列表失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  async updatePermissions(req: Request, res: Response): Promise<Response> {
    try {
      const id = req.params.id;
      const { permissions } = req.body;

      // 验证权限数组
      if (!permissions || !Array.isArray(permissions)) {
        return errorResponse(res, 400, '权限参数格式错误', null);
      }

      const roleRepository = AppDataSource.getRepository(Role);
      const role = await roleRepository.findOne({
        where: { id: Number(id) },
        relations: ['rolePermissions', 'rolePermissions.permission']
      });

      if (!role) return errorResponse(res, 404, '角色不存在', null);

      // 获取当前角色的权限ID列表
      const oldPermissionIds = role.rolePermissions?.map(rp => rp.permissionId) || [];
      // 过滤出有效的权限ID
      const newPermissionIds = permissions.filter((permissionId: any) => 
        typeof permissionId === "number" || (typeof permissionId === "string" && !isNaN(Number(permissionId)))
      ).map((permissionId: any) => Number(permissionId));
   
      // 只有当权限发生变化时才更新
      if (JSON.stringify([...oldPermissionIds].sort()) !== JSON.stringify([...newPermissionIds].sort())) {
        // 删除旧的关联关系
        const rolePermissionsRepository = AppDataSource.getRepository(RolePermission);
        await rolePermissionsRepository.delete({
          roleId: Number(role.id)
        });
        
        // 如果有新的权限，则创建新的关联关系
        if (newPermissionIds.length > 0) {
          // 创建新的关联关系
          const permissionRelations = newPermissionIds.map((permissionId: number) => ({
            roleId: Number(role.id),
            permissionId: permissionId
          }));
          
          // 批量插入新的关联关系
          await rolePermissionsRepository.insert(permissionRelations);
        }
        
        // 记录日志
        logger.info(`角色 ${role.name}(${role.id}) 的权限已更新，权限ID: ${newPermissionIds.join(',')}`);
      }

      return successResponse(res, null, '角色权限更新成功');
    } catch (error) {
      logger.error('更新角色权限失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
}