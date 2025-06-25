import { Request, Response } from 'express';
import { In } from "typeorm";
import { AppDataSource } from '../config/database';
import { User } from '../models/user.model';
import { Role } from '../models/role.model';
import { UserRole } from '../models/user-roles.model';
import { InviteCode } from '../models/invite-code.model';
import { RolePermission } from '../models/role-permission.model';
import { Permission } from '../models/permission.model';
import * as jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';
import { errorResponse, successResponse } from '../utils/response';

const authController = require('../controllers/auth.controller');

export class UserController {
  // 用户登录
  async login(req: Request, res: Response): Promise<Response> {
    try {
      const { username, password, code, captchaId } = req.body;

      if (!authController.verifyCaptcha(captchaId, code)) return errorResponse(res, 400, '验证码错误', null);

      // 查找用户
      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({ 
        select: ['id', 'username', 'password', 'status', 'avatar', 'name', 'email', 'phone'],
        where: { username },
        relations: ['roles', 'roles.platforms']
      });
      // 用户不存在
      if (!user) return errorResponse(res, 401, '用户名或密码错误', null);
      // 验证密码
      const isPasswordValid = await user.validatePassword(password, user.password);
      if (!isPasswordValid) return errorResponse(res, 401, '用户名或密码错误', null);
      // 检查用户状态
      if (user.status !== 1) return errorResponse(res, 403, '账户已被禁用', null);

      // 生成JWT令牌
      const userRoles = user.getRoleCodes();
      const userPlatforms = user.getRolePlatforms();

      // 获取用户可访问的标签
      const accessibleTags = await AppDataSource.createQueryBuilder()
        .select('t.id')
        .from('tags', 't')
        .innerJoin('role_tags', 'rt', 't.id = rt.tag_id')
        .innerJoin('user_roles', 'ur', 'rt.role_id = ur.role_id')
        .where('ur.user_id = :userId', { userId: user.id })
        .andWhere('t.is_deleted = 0')
        .getRawMany();

      const tagIds = accessibleTags.map(tag => tag.t_id).filter(id => id !== null && id !== undefined);

      // 生成 JWT 令牌
      const token = jwt.sign(
        {
          id: user.id,
          roles: userRoles,
          accessTags: tagIds,
          accessPlatforms: userPlatforms 
        },
        process.env.JWT_SECRET || 'ei(@3kdl20KS21020alsa12',
        { expiresIn: '24h' }
      );

      // 更新最后登录时间和IP
      await userRepository.update(user.id, {
        last_login_time: new Date(),
        last_login_ip: req.ip || ''
      });
      
      // 返回用户信息和令牌
      return res.json({
        code: 0,
        message: '登录成功',
        data: {
          token,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            email: user.email,
            avatar: user.avatar,
            roles: userRoles,
            platforms: userPlatforms
          }
        }
      });
    } catch (error) {
      logger.error('登录失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
  
  // 获取用户信息
  async getProfile(req: Request, res: Response): Promise<Response> {
    try {
      // 从请求中获取用户ID（通过auth中间件设置）
      const userId = (req as any).user?.id;
      
      if (!userId) return errorResponse(res, 401, '未授权', null);
      
      // 查询用户信息
      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({
        where: { id: userId },
        relations: ['roles', 'roles.platforms']
      });
      
      if (!user) return errorResponse(res, 404, '用户不存在', null);
      
      // 返回用户信息
      return res.json({
        code: 0,
        message: '获取用户信息成功',
        data: {
          id: user.id,
          username: user.username,
          name: user.name,
          email: user.email,
          phone: user.phone,
          avatar: user.avatar,
          last_login_ip: user.last_login_ip,
          last_login_time: user.last_login_time,
          roles: user.getRoleCodes(),
          platforms: user.getRolePlatforms()
        }
      });
    } catch (error) {
      logger.error('获取用户信息失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 更新用户信息
  async updateProfile(req: Request, res: Response): Promise<Response> {
    try {
      const userId = (req as any).user?.id;
      const { name, email, avatar, phone } = req.body;

      if (!userId) return errorResponse(res, 401, '未授权', null);

      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({
        where: { id: userId }
      });

      if (!user) return errorResponse(res, 404, '用户不存在', null);

      // 更新用户信息
      await userRepository.update(user.id, {
        name: name || user.name,
        email: email || user.email,
        phone: phone || user.phone,
        avatar: avatar || user.avatar,
        updated_at: new Date()
      });

      return successResponse(res, null, '用户信息更新成功');
    } catch (error) {
      logger.error('更新用户信息失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 更新用户密码
  async updatePassword(req: Request, res: Response): Promise<Response> {
    try {
      const userId = (req as any).user?.id;
      const { oldPassword, newPassword } = req.body;

      if (!userId) return errorResponse(res, 401, '未授权', null);

      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({
        select: ['id', 'username', 'password', 'status'],
        where: { id: userId }
      });

      if (!user) return errorResponse(res, 404, '用户不存在', null);
      if (user.status !== 1) return errorResponse(res, 403, '账户已被禁用', null);

      // 验证旧密码
      const isPasswordValid = await user.validatePassword(oldPassword, user.password);
      if (!isPasswordValid) return errorResponse(res, 400, '旧密码错误', null);

      // 更新密码
      await user.setPassword(newPassword);
      
      await userRepository.update(user.id, {
        password: user.password,
        updated_at: new Date()
      });

      return successResponse(res, null, '密码更新成功');
    } catch (error) {
      logger.error('更新用户密码失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 用户注册
  async register(req: Request, res: Response): Promise<Response> {
    try {
      const { username, password, code, captchaId, inviteCode } = req.body;

      // 检查验证码是否正确
      if (!authController.verifyCaptcha(captchaId, code)) return errorResponse(res, 400, '验证码错误', null);
      
      // 检查用户名是否已存在
      const userRepository = AppDataSource.getRepository(User);
      const existingUser = await userRepository.findOne({ where: { username } }); 
      if (existingUser) return errorResponse(res, 400, '用户名已存在', null);

      // 验证邀请码
      // const inviteCodeRepository = AppDataSource.getRepository(InviteCode);
      // const invite = await inviteCodeRepository.findOne({ where: { code: inviteCode } });
      
      // if (!invite) return errorResponse(res, 400, '邀请码不存在', null);
      // if (!invite.isValid()) return errorResponse(res, 400, '邀请码已过期或已被使用', null);

      // 创建新用户
      const newUser = new User();
      newUser.username = username;
      await newUser.setPassword(password);
      newUser.name = '';
      newUser.email = '';
      newUser.avatar = '';
      newUser.status = 1;
      newUser.created_at = new Date();
      newUser.updated_at = new Date();
      newUser.last_login_time = new Date();
      newUser.last_login_ip = req.ip || '';
      
      // 保存用户
      const savedUser = await userRepository.save(newUser);
      
      // 更新邀请码状态
      // invite.used = true;
      // invite.usedBy = savedUser.id;
      // invite.usedAt = new Date();
      // await inviteCodeRepository.save(invite);
      
      // 返回注册成功信息
      return successResponse(res, null, '注册成功');
    } catch (error) {
      logger.error('注册失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
  
  // 生成邀请码
  async generateInviteCode(req: Request, res: Response): Promise<Response> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return errorResponse(res, 401, '未授权', null);
      
      // 生成随机邀请码
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      
      // 设置过期时间（默认7天后过期）
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      
      // 创建邀请码记录
      const inviteCodeRepository = AppDataSource.getRepository(InviteCode);
      const newInviteCode = new InviteCode();
      newInviteCode.code = code;
      newInviteCode.creatorId = userId;
      newInviteCode.expiresAt = expiresAt;
      
      await inviteCodeRepository.save(newInviteCode);
      
      return successResponse(res, {
        code,
        expiresAt
      }, '邀请码生成成功');
    } catch (error) {
      logger.error('生成邀请码失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
  
  // 获取我的邀请码列表
  async getMyInviteCodes(req: Request, res: Response): Promise<Response> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return errorResponse(res, 401, '未授权', null);
      
      const inviteCodeRepository = AppDataSource.getRepository(InviteCode);
      const inviteCodes = await inviteCodeRepository.find({
        where: { creatorId: userId },
        order: { createdAt: 'DESC' }
      });
      
      return successResponse(res, inviteCodes, '获取邀请码列表成功');
    } catch (error) {
      logger.error('获取邀请码列表失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  async updateRole(req: Request, res: Response): Promise<Response> {
    try {
      const staffId = req.params.id;
      const { roles } = req.body;

      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.createQueryBuilder("user")
      .leftJoinAndSelect('user.staff', 'staff')
      .leftJoinAndSelect('user.roles','roles')
      .where("staff.id = :staffId", { staffId: staffId })
      .getOne();

      if (!user) return errorResponse(res, 404, '用户不存在', null);

      const oldRoles = user.roles?.map(role => role.id) || []
      const newRoles = roles.filter((role: any) => typeof role === "number")
   
      // 只有当标签发生变化时才更新
      if (JSON.stringify([...oldRoles].sort()) !== JSON.stringify([...newRoles].sort())) {

        const roleRepository = AppDataSource.getRepository(Role);
        const roleEntities = await roleRepository.find({
          where: {
            id: In(newRoles)
          }
        })
        
        user.roles = roleEntities
        
        // 删除旧的关联关系
        const userRoleRepository = AppDataSource.getRepository(UserRole);
        await userRoleRepository.delete({
          userId: user.id
        })
        
        // 创建新的关联关系
        const roleRelations = newRoles.map((roleId: number) => ({
          userId: user.id,
          roleId
        }))
        
        await userRoleRepository.insert(roleRelations)
      }

      await userRepository.save(user);
      return successResponse(res, null, '用户角色更新成功');
    } catch (error) {
      logger.error('更新用户角色失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  async getUnbindUsers(req: Request, res: Response): Promise<Response> {
    try {
        const { keyword } = req.query;
  
        // 查询模板
        const userRepository = AppDataSource.getRepository(User);
        let queryBuilder = userRepository.createQueryBuilder("user")
        .leftJoinAndSelect('user.staff', 'staff')
        .where("staff.id IS NULL")
        
        if (keyword) {
          queryBuilder = queryBuilder.andWhere("user.username LIKE :keyword", { keyword: `%${keyword}%` });
        }
  
        const users = await queryBuilder.getMany();

        return res.json({
          code: 0,
          message: '获取用户列表成功',
          data: users
        });
    } catch (error) {
        logger.error('获取型号列表失败:', error);
        return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  async getUserRoles(req: Request, res: Response): Promise<Response> {
    try {
      const userId = req.params.id;
      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.createQueryBuilder("user")
        .leftJoinAndSelect('user.roles','roles')
        .where("user.id = :userId", { userId: userId })
        .getOne();

      if (!user) return errorResponse(res, 404, '用户不存在', null);

      return res.json({
        code: 0,
        message: '获取用户角色列表成功',
        data: user.roles
      });
    } catch (error) {
      logger.error('获取用户角色列表失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  async getUserPermissions(req: Request, res: Response): Promise<Response> {
    try {
      const userId = (req as any).user.id;
      
      // 获取用户角色
      const userRoles = await AppDataSource
        .getRepository(UserRole)
        .createQueryBuilder('userRole')
        .leftJoinAndSelect('userRole.role', 'role')
        .where('userRole.userId = :userId', { userId })
        .getMany();
      
      const roleIds = userRoles.map(ur => ur.roleId);
      const roleCodes = userRoles.map(ur => ur.role?.code || '');
  
      // 检查是否包含 ADMIN 角色
      const isAdmin = roleCodes.includes('ADMIN');
      
      if (roleIds.length === 0 && !isAdmin) {
        return successResponse(res, { permissions: [] }, '用户没有分配角色');
      }
      
      let permissions: Permission[] = [];
      
      // 如果是管理员，获取所有权限
      if (isAdmin) {
        permissions = await AppDataSource.getRepository(Permission)
          .createQueryBuilder('permission')
          .where('permission.status = :status', { status: 1 })
          .getMany();
      } else {
        // 获取角色权限
        const rolePermissions = await AppDataSource.getRepository(RolePermission)
          .createQueryBuilder('rolePermission')
          .leftJoinAndSelect('rolePermission.permission', 'permission')
          .where('rolePermission.roleId IN (:...roleIds)', { roleIds })
          .andWhere('permission.status = :status', { status: 1 })
          .getMany();
        
        // 去重，获取直接分配的权限ID
        const permissionMap = new Map();
        const permissionIds: number[] = [];
        
        rolePermissions.forEach(rp => {
          if (rp.permission) {
            permissionMap.set(rp.permission.id, rp.permission);
            permissionIds.push(rp.permission.id);
          }
        });
        
        if (permissionIds.length > 0) {
          // 获取所有权限（包括父节点）
          const allPermissions = await AppDataSource.getRepository(Permission)
            .createQueryBuilder('permission')
            .where('permission.status = :status', { status: 1 })
            .orderBy('permission.sort', 'ASC')
            .getMany();
          
          // 找出所有权限的父节点
          const parentMap = new Map<number, Permission>();
          
          // 先将所有权限放入映射表
          allPermissions.forEach(p => {
            parentMap.set(p.id, p);
          });
          
          // 为每个权限找到其所有父节点
          const completePermissionMap = new Map<number, Permission>();
          
          // 递归查找父节点
          const findParents = (permissionId: number) => {
            const permission = parentMap.get(permissionId);
            if (!permission) return;
            
            // 如果该权限已经在完整权限映射中，则跳过
            if (completePermissionMap.has(permission.id)) return;
            
            // 添加到完整权限映射
            completePermissionMap.set(permission.id, permission);
            
            // 如果有父节点，递归查找
            if (permission.parentId) {
              findParents(permission.parentId);
            }
          };
          
          // 为每个直接分配的权限查找其父节点
          permissionIds.forEach(id => {
            findParents(id);
            
            // 将直接分配的权限也添加到完整权限映射
            const directPermission = permissionMap.get(id);
            if (directPermission) {
              completePermissionMap.set(id, directPermission);
            }
          });
          
          // 转换为数组
          permissions = Array.from(completePermissionMap.values());
        }
      }
      
      // 构建权限树
      const permissionTree = this.buildPermissionTree(permissions);
      
      return successResponse(res, {
        permissions: permissionTree,
      }, '获取用户权限成功');
    } catch (error) {
      console.error('获取用户权限失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

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