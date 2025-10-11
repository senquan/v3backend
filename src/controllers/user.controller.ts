import { Request, Response } from 'express';
import { In } from "typeorm";
import * as jwt from 'jsonwebtoken';
import axios from 'axios';
import { AppDataSource } from '../config/database';
import { ConstructionWorker } from '../models/entities/ConstructionWorker.entity';
import { Courseware } from '../models/entities/Courseware.entity';
import { Exam } from '../models/entities/Exam.entity';
import { ExamRecord } from '../models/entities/ExamRecord.entity';
import { CoursewareMaterial } from '../models/entities/CoursewareMaterial.entity';
import { TrainingRecordProgressDetail } from '../models/entities/TrainingRecordProgressDetail.entity';
import { TrainingUser } from '../models/entities/TrainingUser.entity';
import { TrainingRecord } from '../models/entities/TrainingRecord.entity';
import { User } from '../models/entities/User.entity';
import { Role } from '../models/entities/Role.entity';
import { UserRole } from '../models/entities/UserRole.entity';
import { Permission } from '../models/entities/Permission.entity';
import { RolePermission } from '../models/entities/RolePermission.entity';
import { ProjectDepartmentMember } from '../models/entities/ProjectDepartmentMember.entity';
import { TrainingRecordCourseware } from '../models/entities/TrainingRecordCourseware.entity';
import { TrainingRecordParticipant } from '../models/entities/TrainingRecordParticipant.entity';
import { TrainingRecordProgress } from '../models/entities/TrainingRecordProgress.entity';
import { logger } from '../utils/logger';
import { errorResponse, successResponse } from '../utils/response';

interface WechatUserInfo {
  openid: string;
  nickname?: string;
  sex?: number;
  province?: string;
  city?: string;
  country?: string;
  headimgurl?: string;
  unionid?: string;
}

interface WechatTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  openid: string;
  scope: string;
  unionid?: string;
}

interface WechatSessionResponse {
  openid: string;
  session_key: string;
  unionid?: string;
}

const authController = require('../controllers/auth.controller');

const WECHAT_CONFIG = {
  appId: process.env.WECHAT_APP_ID || '',
  appSecret: process.env.WECHAT_APP_SECRET || '',
  grantType: 'authorization_code'
};

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export class UserController {
  // 用户登录
  async login(req: Request, res: Response): Promise<Response> {
    try {
      const { username, password, code, captchaId } = req.body;

      if (!authController.verifyCaptcha(captchaId, code)) return errorResponse(res, 400, '验证码错误', null);

      // 查找用户
      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({ 
        select: ['_id', 'name', 'password', 'status', 'realname', 'email', 'phone'],
        where: { name: username }
      });
      // 用户不存在
      if (!user) return errorResponse(res, 401, '用户名或密码错误', null);
      // 验证密码
      const isPasswordValid = await user.validatePassword(password, user.password);
      if (!isPasswordValid) return errorResponse(res, 401, '用户名或密码错误', null);
      // 检查用户状态
      if (user.status !== 1) return errorResponse(res, 403, '账户状态异常', null);

      // 获取用户信息
      const profileRepository = AppDataSource.getRepository(TrainingUser);
      let profile = await profileRepository.findOne({
        where: { global_id: user._id, type: 1 }
      });
      if (!profile) {
        const newUser = profileRepository.create({
          global_id: user._id,
          name: user.name,
          realname: user.realname,
          type: user.type,
          phone: user.phone,
          avatar: null,
          gender: "M",
          wechat_openid: null,
          wechat_unionid: null,
          is_deleted: 0,
          created_at: new Date(),
          updated_at: new Date()
        });
        profile = await profileRepository.save(newUser);
      }
      
      // 生成 JWT 令牌
      const token = jwt.sign(
        {
          id: user._id,
          profile_id: profile.id
        },
        process.env.JWT_SECRET || 'EA(@eroiw302sodD03p21',
        { expiresIn: '24h' }
      );

      // 返回用户信息和令牌
      return successResponse(res, {
        token,
        user: {
          id: user._id,
          profile_id: profile.id,
          type: 1,
          realname: user.realname,
          name: user.name,
          email: user.email,
          phone: user.phone
        }
        }, '登录成功');
    } catch (error) {
      logger.error('登录失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 获取用户列表
  async getList(req: Request, res: Response): Promise<Response> {
    try {
      const { page = 1, pageSize = 20, keyword, type, status } = req.query;
      let branch = req.query.branch;
      let project =req.query.project;
      let id = req.query.id;
      if (id) {
        id = String(id);
        const [type, idv] = id.split('_');
        if (type === 'branch') {
            branch = idv;
        } else if (type === 'dept') {
            project = idv;
        }
      }

      // 计算分页
      const pageNum = Number(page);
      const pageSizeNum = Number(pageSize);
      const skip = (pageNum - 1) * pageSizeNum;

      let queryBuilder

      if (type === "outer") {
        queryBuilder = AppDataSource.getRepository(ConstructionWorker)
         .createQueryBuilder('worker');

        if (project) {
          queryBuilder.where('worker.project = :project', { project: Number(project) });
        } else if (branch) {
          queryBuilder.where('worker.branch = :branch', { branch: Number(branch) });
        } else {
          queryBuilder.where('worker.id = :id', { id: 0 });
        }
        queryBuilder
            .andWhere('worker.employee_type is null')
            .andWhere('worker.status = :status', { status: Number(90) });

      } else if (project) {
        queryBuilder = AppDataSource.getRepository(ProjectDepartmentMember)
        .createQueryBuilder('member')
        .leftJoinAndSelect('member.memberUser', 'user')
        .where('member._parent = :project', { project: Number(project) });
      } else {

        queryBuilder = AppDataSource.getRepository(User)
        .createQueryBuilder('user')
        .select([
            'user._id',
            'user.name',
            'user.realname',
            'user.type',
            'user.branch',
            'user.email',
            'user.phone',
            'user.status'
        ]);
        
        if (keyword) {
            queryBuilder.andWhere('(user.name LIKE :keyword OR user.realname LIKE :keyword)', { keyword: `%${keyword}%` });
        }
        if (status) {
            queryBuilder.andWhere('user.status = :status', { status: Number(status) });
        }
        if (branch) {
            queryBuilder.andWhere('user.branch = :branch', { branch: Number(branch) });
        }
        queryBuilder.orderBy('user._id', 'DESC');
      }

      // 获取总数和分页数据
      const [users, total] = await queryBuilder
        .skip(skip)
        .take(pageSizeNum)
        .getManyAndCount();
      
      // 格式化用户数据
      let formattedUsers = [];
      if (type === "outer") {
        formattedUsers = users.map((user: any) => ({
          id: user._id,
          name: user.name,
          realname: user.name,
        }));
      } else if (project) {
        formattedUsers = users.map((user: any) => ({
          id: user._id,
          name: user.memberUser.name,
          realname: user.memberUser.realname,
        }))
      } else {
        formattedUsers = users.map((user: any) => ({
            id: user._id,
            name: user.name,
            realname: user.realname,
            type: user.type,
            branch: user.branch,
            email: user.email,
            phone: user.phone,
            status: user.status
        }));
      }
      
      return successResponse(res, {
        users: formattedUsers,
        total,
        page: pageNum,
        pageSize: pageSizeNum
      }, '获取用户列表成功');
    } catch (error) {
      logger.error('获取用户列表失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 获取子系统用户列表
  async getLocalList(req: Request, res: Response): Promise<Response> {
    try {
      const { page = 1, pageSize = 20, keyword, type } = req.query;

      // 计算分页
      const pageNum = Number(page);
      const pageSizeNum = Number(pageSize);
      const skip = (pageNum - 1) * pageSizeNum;

      // 构建查询，根据type关联不同表
      let queryBuilder = AppDataSource.getRepository(TrainingUser)
        .createQueryBuilder('trainingUser')
        .select([
            'trainingUser.id',
            'trainingUser.global_id',
            'trainingUser.name',
            'trainingUser.realname',
            'trainingUser.type',
            'trainingUser.gender'
        ])
        // 左连接User表(type=1)
        .leftJoin(User, 'user', 'trainingUser.global_id = user._id AND trainingUser.type = 1')
        .addSelect([
            'user.branch',
            'user.email',
            'user.phone',
            'user.status',
            'user.oa_id',
            'user.join_date'
        ])
        // 左连接ConstructionWorker表(type=2)
        .leftJoin(ConstructionWorker, 'worker', 'trainingUser.global_id = worker._id AND trainingUser.type = 2')
        .addSelect([
            'worker.branch',
            'worker.phone',
            'worker.status',
            'worker.project'
        ]);
        
      if (keyword) {
          queryBuilder.andWhere('(trainingUser.name LIKE :keyword OR trainingUser.realname LIKE :keyword)', { keyword: `%${keyword}%` });
      }
      queryBuilder.orderBy('trainingUser.id', 'DESC');

      // 获取总数和分页数据
      const [users, total] = await queryBuilder
        .skip(skip)
        .take(pageSizeNum)
        .getManyAndCount();
      
      // 格式化用户数据
      const formattedUsers = users.map((profile: any) => {
        // 根据用户类型获取关联数据
        const relatedData = profile.type === 1 ? profile.user : profile.worker;
        
        return {
          id: profile.global_id,
          name: profile.name,
          realname: profile.realname,
          gender: profile.gender,
          type: profile.type,
          branch: relatedData?.branch || null,
          email: profile.type === 1 ? relatedData?.email : null,
          phone: relatedData?.phone || null,
          status: relatedData?.status || null,
          oa_id: profile.type === 1 ? relatedData?.oa_id : null,
          join_date: profile.type === 1 ? relatedData?.join_date : null,
          project: profile.type === 2 ? relatedData?.project : null
        };
      });

      const roles = await AppDataSource.getRepository(Role).find(
        { where: { isDeleted: 0 } }
      );
      
      return successResponse(res, {
        users: formattedUsers,
        roles,
        total,
        page: pageNum,
        pageSize: pageSizeNum
      }, '获取用户列表成功');
    } catch (error) {
      logger.error('获取用户列表失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
  
  // 获取用户详情
  async getDetail(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      
      const user = await AppDataSource.getRepository(User)
        .createQueryBuilder('user')
        .select([
          'user._id',
          'user.name',
          'user.realname',
          'user.lang',
          'user.type',
          'user.branch',
          'user.join_date',
          'user.age',
          'user.married',
          'user.status',
          'user.email',
          'user.phone',
          'user.oa_id',
          'user.entrance',
          'user.notes',
          'user.create_time',
          'user.update_time'
        ]) // 不返回密码等敏感信息
        .where('user._id = :id', { id: Number(id) })
        .getOne();
      
      if (!user) {
        return errorResponse(res, 404, '用户不存在', null);
      }
      
      const formattedUser = {
        id: user._id,
        name: user.name,
        realname: user.realname,
        lang: user.lang,
        type: user.type,
        branch: user.branch,
        join_date: user.join_date,
        age: user.age,
        married: user.married,
        status: user.status,
        email: user.email,
        phone: user.phone,
        oa_id: user.oa_id,
        entrance: user.entrance,
        notes: user.notes,
        created_at: user.create_time,
        updated_at: user.update_time
      };
      
      return successResponse(res, formattedUser, '获取用户详情成功');
    } catch (error) {
      logger.error('获取用户详情失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 获取用户信息
  async getProfile(req: Request, res: Response): Promise<Response> {
    try {
      const userId = (req as any).user?._id;
      const profileId = (req as any).user?.profile_id;
      
      if (!userId) {
        return errorResponse(res, 401, '未授权', null);
      }
      
      // 查询用户信息
      const userRepository = AppDataSource.getRepository(TrainingUser);
      const user = await userRepository.findOne({
        where: { id: profileId },
        relations: ['roles', 'roles.role']
      });
      
      if (!user) {
        return errorResponse(res, 404, '用户不存在', null);
      }

      const roleIds = user.roles?.map(role => role.roleId) || [];
      const rolePermissions = roleIds.length > 0
        ? await AppDataSource.getRepository(RolePermission)
            .createQueryBuilder('rolePermission')
            .innerJoinAndSelect('rolePermission.permission', 'permission')
            .where('rolePermission.roleId IN (:...roleIds)', { roleIds })
            .andWhere('permission.status = :status', { status: 1 })
            .orderBy('permission.sort', 'ASC')
            .getMany()
        : [];
      
      // 返回用户信息
      return res.json({
        code: 0,
        message: '获取用户信息成功',
        data: {
          id: userId,
          username: user.name,
          name: user.realname,
          avatar: user.avatar,
          roles: user.getRoleCodes(),
          permissions: rolePermissions.map(rolePermission => rolePermission.permission.code),
        }
      });
    } catch (error) {
      logger.error('获取用户信息失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  async getUserRoles(req: Request, res: Response): Promise<Response> {
    try {
      const userId = req.params.id;
      const userRepository = AppDataSource.getRepository(TrainingUser);
      const user = await userRepository.createQueryBuilder("user")
        .leftJoinAndSelect('user.roles', 'roles')
        .where("user.id = :userId", { userId: Number(userId) })
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

  async updateUserRole(req: Request, res: Response): Promise<Response> {
    try {
      const userId = req.params.id;
      const { roles } = req.body;

      const userRepository = AppDataSource.getRepository(TrainingUser);
      const user = await userRepository.createQueryBuilder("user")
      .leftJoinAndSelect('user.roles','roles')
      .where("user.id = :userId", { userId: Number(userId) })
      .getOne();

      if (!user) return errorResponse(res, 404, '用户不存在', null);

      const oldRoles = user.roles?.map(role => role.roleId) || []
      const newRoles = roles.filter((role: any) => typeof role === "number")
   
      // 只有当标签发生变化时才更新
      if (JSON.stringify([...oldRoles].sort()) !== JSON.stringify([...newRoles].sort())) {

        const roleRepository = AppDataSource.getRepository(Role);
        const roleEntities = await roleRepository.find({
          where: {
            id: In(newRoles)
          }
        })

        const deleteIds = oldRoles.filter(id => !newRoles.includes(id))
        const addIds = newRoles.filter((id: number) => !oldRoles.includes(id))
        
        // 删除旧的关联关系
        const userRoleRepository = AppDataSource.getRepository(UserRole);
        if (deleteIds.length > 0) {
          await userRoleRepository.delete({
            userId: user.id,
            roleId: In(deleteIds)
          });
        }
        
        // 创建新的关联关系
        if (addIds.length > 0) {
          const roleRelations = addIds.map((roleId: number) => ({
            userId: user.id,
            roleId
          }));
          await userRoleRepository.insert(roleRelations);
        }
      }
      return successResponse(res, null, '用户角色更新成功');
    } catch (error) {
      logger.error('更新用户角色失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  async getUserPermissions(req: Request, res: Response): Promise<Response> {
    try {
      const userId = (req as any).user.profile_id;
      const DEFAULT_ROLE_ID = 1;
      
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
        roleIds.push(DEFAULT_ROLE_ID);
        roleCodes.push('COMMON');
      }

      let permissions: Permission[] = [];
      
      // 如果是管理员，获取所有权限
      if (isAdmin) {
        permissions = await AppDataSource.getRepository(Permission)
          .createQueryBuilder('permission')
          .where('permission.status = :status', { status: 1 })
          .andWhere('permission.type = :type', { type: 1 })
          .orderBy('permission.sort', 'ASC')
          .getMany();
      } else {
        // 获取角色权限
        const rolePermissions = await AppDataSource.getRepository(RolePermission)
          .createQueryBuilder('rolePermission')
          .leftJoinAndSelect('rolePermission.permission', 'permission')
          .where('rolePermission.roleId IN (:...roleIds)', { roleIds })
          .andWhere('permission.status = :status', { status: 1 })
          .andWhere('permission.type = :type', { type: 1 })
          .orderBy('permission.sort', 'ASC')
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
            .andWhere('permission.type = :type', { type: 1 })
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
          permissions.sort((a, b) => a.sort - b.sort)
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

  // 微信用户登录
  async wechatLogin(req: Request, res: Response): Promise<Response> {
    try {
      const { code, type = 'miniprogram' } = req.body;
      
      if (!code) {
        return errorResponse(res, 400, '缺少微信登录凭证');
      }
      
      if (!WECHAT_CONFIG.appId || !WECHAT_CONFIG.appSecret) {
        return errorResponse(res, 500, '缺少微信配置，请提供 appId 和 appSecret');
      }

      logger.info(`Starting WeChat ${type} login process with code: ${code.substring(0, 10)}...`);

      // 根据登录类型选择不同的处理方式
      if (type === 'miniprogram') {
        return await this.wechatMiniprogramLogin(req, res);
      } else {
        return await this.wechatWebLogin(req, res);
      }
      
    } catch (error: any) {
      logger.error('WeChat login error:', error);
      
      // Handle specific error types
      if (error?.message?.includes('invalid_grant')) {
        return errorResponse(res, 400, 'Invalid or expired authorization code');
      } else if (error?.message?.includes('rate limit')) {
        return errorResponse(res, 429, 'WeChat API rate limit exceeded, please try again later');
      } else if (error?.code === 'ECONNREFUSED' || error?.code === 'ENOTFOUND') {
        return errorResponse(res, 503, 'WeChat service temporarily unavailable');
      } else {
        return errorResponse(res, 500, 'WeChat login failed');
      }
    } 
  }

  // 微信网页登录
  async wechatWebLogin(req: Request, res: Response): Promise<Response> {
    try {
      const { code } = req.body;
      
      const tokenData = await this.exchangeCodeForToken(code);
      if (!tokenData) {
        return errorResponse(res, 400, 'Failed to exchange authorization code for access token');
      }
      
      logger.info(`Successfully obtained access token for openid: ${tokenData.openid}`);

      // Step 2: Get user information from WeChat
      const userInfo = await this.getWechatUserInfo(tokenData.access_token, tokenData.openid);
      
      // Step 3: Find or create user in database
      const user = await this.findUser({
        openid: tokenData.openid,
        unionid: tokenData.unionid,
        nickname: userInfo?.nickname,
        avatar: userInfo?.headimgurl,
        province: userInfo?.province,
        city: userInfo?.city,
        country: userInfo?.country
      });

      if (!user) {
        return successResponse(res, {
          needBindPhone: true,
          openid: tokenData.openid,
          unionid: tokenData.unionid
        }, '用户未绑定，请授权手机号码');
      }
      user.id = user.global_id;
      // Step 4: Generate JWT token
      const token = this.generateJwtToken(user, 'wechat');
      
      logger.info(`WeChat web login successful for user: ${user.id}`);

      return successResponse(res, {
        token,
        user: {
          id: user.global_id,
          learner_id: user.id,
          type: 2,
          realname: user.realname,
          name: user.name,
          email: user.email,
          phone: user.phone
        }
      }, '微信登录成功');
      
    } catch (error: any) {
      logger.error('WeChat web login error:', error);
      throw error;
    }
  }

  // 微信小程序登录
  async wechatMiniprogramLogin(req: Request, res: Response): Promise<Response> {
    try {
      const { code } = req.body;
      
      const sessionData = await this.exchangeJscodeForSession(code);
      if (!sessionData) {
        return errorResponse(res, 400, 'Failed to exchange jscode for session');
      }
      
      logger.info(`Successfully obtained session for openid: ${sessionData.openid}`);

      // Step 2: Find user in database (小程序登录不需要获取用户信息)
      const user = await this.findUser({
        openid: sessionData.openid,
        unionid: sessionData.unionid
      });

      if (!user) {
        return successResponse(res, {
          needBindPhone: true,
          openid: sessionData.openid,
          unionid: sessionData.unionid
        }, '用户未绑定，请授权手机号码');
      }
      user.id = user.global_id;
      // Step 3: Generate JWT token
      const token = this.generateJwtToken(user, 'wechat');
      
      logger.info(`WeChat miniprogram login successful for user: ${user.id}`);

      return successResponse(res, {
        token,
        user: {
          id: user.global_id,
          learner_id: user.id,
          type: 2,
          realname: user.realname,
          name: user.name,
          email: user.email,
          phone: user.phone
        }
      }, '微信登录成功');
      
    } catch (error: any) {
      logger.error('WeChat miniprogram login error:', error);
      throw error;
    }
  }

  // 获取用户培训计划详情
  async myPlanDetail(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const user = (req as any).user;
      if (!user) {
        return errorResponse(res, 401, '未认证', null);
      }

      const planRecord = await AppDataSource.getRepository(TrainingRecord)
        .createQueryBuilder('record')
        .innerJoinAndSelect('record.training_plan', 'plan')
        .innerJoinAndSelect('plan.trainer', 'trainer')
        .andWhere('record.id = :recordId', { recordId: id })
        .getOne();

      if (!planRecord) {
        return errorResponse(res, 404, '培训计划不存在', null);
      }

      const userType = user.type === 2 ? 2 : 1;
      const participantBuilder = AppDataSource.getRepository(TrainingRecordParticipant)
        .createQueryBuilder('participant')
        .where('participant.training_record_id = :recordId', { recordId: id })

      if (userType === 1) {
        participantBuilder.andWhere('participant.user_id = :userId', { userId: user.id });
      } else {
        participantBuilder.andWhere('participant.worker_id = :workerId', { workerId: user.id });
      }
      const participant = await participantBuilder.getOne();

      const formattedPlan = {
					title: planRecord.training_plan.name,
					description: planRecord.training_plan.description,
					fullDescription: planRecord.training_plan.full_description,
					cover: planRecord.training_plan.cover,
					difficulty: planRecord.training_plan.difficulty,
					type: planRecord.training_plan.training_category,
					startDate: planRecord.training_plan.planned_time,
					deadline: planRecord.training_plan.planned_time,
					instructor: planRecord.training_plan.trainer.name,
          isSignIn: participant !== null
      }

      if (!participant) {
        return successResponse(res, formattedPlan, '培训计划未签到');
      }

      // 获取培训记录对应课件列表
      const coursewareData = await AppDataSource.getRepository(TrainingRecordCourseware)
        .createQueryBuilder('recordCourseware')
        .innerJoinAndSelect('recordCourseware.courseware', 'courseware')
        .where('recordCourseware.training_record_id = :recordId', { recordId: id })
        .andWhere('courseware.is_deleted = :is_deleted', { is_deleted: 0 })
        .andWhere('courseware.status = :status', { status: 1 })
        .orderBy('recordCourseware.sort', 'ASC')
        .getMany();

      // 获取培训记录对应进度列表
      const progressData = await AppDataSource.getRepository(TrainingRecordProgress)
        .createQueryBuilder('progress')
        .where('progress.training_record_participant_id = :participantId', { participantId: participant.id })
        .getMany();
      // 合并进度数据
      const progressMap = new Map(progressData.map(item => [item.courseware_id, item]));

      let totalDuration = 0
      const coursewares = coursewareData.map(item => {
        totalDuration += item.courseware.duration;
        const progress = progressMap.get(item.courseware_id)?.progress || 0;
        return {
          id: item.courseware._id,
          title: item.courseware.title,
          description: item.courseware.subtitle,
          duration: item.courseware.duration,
          type: item.courseware.type,
          isCompleted: progress >= 100,
          isLocked: progressMap.get(item.courseware_id)?.is_locked,
          progress
        }
      });

      // 获取考试记录
      const exam = await AppDataSource.getRepository(ExamRecord)
        .createQueryBuilder('record')
        .innerJoinAndSelect('record.examEntity', 'exam')
        .where('record.training_record_id = :recordId', { recordId: id })
        .andWhere('record.participant_id = :participant', { participant: participant.id })
        .getOne();

      // 计算总进度
      const eachProgress = 100 / (coursewares.length + (participant.exam_count || 0));
      let totalProgress = 0
      coursewares.forEach(item => {
        totalProgress += Math.round(eachProgress * (item.progress / 100));
      })

      const formattedPlanDetail = {
        id: participant.id,
        status: totalProgress >= 100 ? 'completed' : 'in_progress',
        progress: totalProgress,
        isSignin: participant.is_signin,
        courseCount: coursewares.length,
        totalDuration,
        isFavorited: false,
        tags: [],
        objectives: planRecord.training_plan.objectives?.split(",,"),
        hasExam: exam ? true : false,
        examId: exam?.exam_id,
        examTitle: exam?.examEntity.title,
        examDesc: exam?.examEntity.description,
        examQuestionCount: exam?.examEntity.question_count,
        examDuration: exam?.examEntity.duration,
        examPassScore: exam?.examEntity.pass_score,
        courses: coursewares
      }

      return successResponse(res, {
        ...formattedPlan,
        ...formattedPlanDetail
      }, '获取培训计划详情成功');
    } catch (error) {
      logger.error('获取培训计划详情失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 获取用户学习统计
  async getLearningStats(req: Request, res: Response): Promise<Response> {

    const user = (req as any).user;
    if (!user) {
      return errorResponse(res, 401, '未认证', null);
    }
    const userType = user.type === 2 ? 2 : 1;

    try{
      // 已完成课程
      const completedCoursesBuilder = AppDataSource.getRepository(TrainingRecordProgress)
        .createQueryBuilder('progress')
        .innerJoinAndSelect('progress.training_record_participant', 'participant')
        .innerJoinAndSelect('progress.courseware', 'courseware')

      if (userType === 1) {
        completedCoursesBuilder.where('participant.user_id = :userId', { userId: user.id });
      } else {
        completedCoursesBuilder.where('participant.worker_id = :workerId', { workerId: user.id });
      }

      let completed = 0;
      let totalStudy = 0;
      const progressData = await completedCoursesBuilder.getMany();
      progressData.forEach(item => {
        if (item.progress >= 100) {
          completed++;
          totalStudy += item.courseware.duration;
        } else {
          totalStudy += Math.round(item.courseware.duration * item.progress / 100);
        }
      })

      const examBuilder = AppDataSource.getRepository(ExamRecord)
        .createQueryBuilder('examRecord')
        .innerJoin('examRecord.participant', 'participant')

      if (userType === 1) {
        examBuilder.where('participant.user_id = :userId', { userId: user.id });
      } else {
        examBuilder.where('participant.worker_id = :workerId', { workerId: user.id });
      }

      examBuilder.andWhere('examRecord.is_passed = :is_passed', { is_passed: true })
      const examPassed = await examBuilder.getCount();

      const learningStats = {
        completedCourses: completed,
        passedExams: examPassed,
        totalStudyTime: totalStudy,
        achievements: 0
      }

      return successResponse(res, {
        stats: learningStats
      }, '获取用户学习统计成功');
    } catch (error) {
      logger.error('获取培训计划列表失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 获取用户培训计划列表
  async myPlanList(req: Request, res: Response): Promise<Response> {
    try {
      const user = (req as any).user;
      if (!user) {
        return errorResponse(res, 401, '未认证', null);
      }

      const userType = user.type === 2 ? 2 : 1;      
      const planBuilder = AppDataSource.getRepository(TrainingRecordParticipant)
        .createQueryBuilder('participant')
        .innerJoinAndSelect('participant.training_record', 'record', 'record.status = :status', { status: 1 })
        .innerJoinAndSelect('record.training_plan', 'plan', 'plan.is_deleted = :is_deleted', { is_deleted: 0 })
        .innerJoinAndSelect('plan.trainer', 'trainer');
        
      if (userType === 1) {
        planBuilder.where('participant.user_id = :userId', { userId: user.id });
      } else {
        planBuilder.where('participant.worker_id = :workerId', { workerId: user.id });
      }

      const plans = await planBuilder
        .orderBy('record.create_time', 'DESC')
        .getMany();

      const formattedPlans = plans.map(item => ({
        id: item.training_record.id,
        title: item.training_record.training_plan.name,
        description: item.training_record.training_plan.description,
        status: this.getPlansStatus(item.progress),
        progress: item.progress,
        courseCount: item.course_count,
        deadline: item.training_record.training_plan.planned_end_time,
      }))

      return successResponse(res, {
        plans: formattedPlans
      }, '获取培训计划列表成功');
    } catch (error) {
      logger.error('获取培训计划列表失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 获取培训计划状态
  private getPlansStatus(progress: number) {
    if (progress >= 100) {
      return 'completed';
    } else if (progress > 0) {
      return 'in_progress';
    } else {
      return 'not_started';
    }
  }

  // 获取用户最近学习记录
  async myRecordList(req: Request, res: Response): Promise<Response> {
    try {
      const user = (req as any).user;
      if (!user) {
        return errorResponse(res, 401, '未认证', null);
      }
      const userType = user.type === 2 ? 2 : 1;      

      const builder = AppDataSource.getRepository(TrainingRecordProgress)
        .createQueryBuilder('progress')
        .innerJoinAndSelect('progress.training_record_participant', 'participant')
        .innerJoinAndSelect('progress.courseware', 'courseware')

      if (userType === 1) {
        builder.where('participant.user_id = :userId', { userId: user.id });
      } else {
        builder.where('participant.worker_id = :workerId', { workerId: user.id });
      }
      
      const records = await builder.orderBy('progress.update_time', 'DESC').getMany();

      const formattedRecords = records.map(item => ({
        id: item.courseware_id,
        partId: item.training_record_participant_id,
        title: item.courseware.title,
        cover: item.courseware.cover,
        progress: item.progress,
        lastLearnTime: item.update_time,
      }))

      return successResponse(res, {
        records: formattedRecords
      }, '获取最近学习记录成功');

    } catch (error) {
      logger.error('获取最近学习记录失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 获取用户课程详情
  async myCourseDetail(req: Request, res: Response): Promise<Response> {
    try {
      const user = (req as any).user;
      if (!user) {
        return errorResponse(res, 401, '未认证', null);
      }
      const courseId = req.params.courseId;
      const partId = req.params.partId;
      const course = await AppDataSource.getRepository(Courseware)
        .createQueryBuilder('courseware')
        .where('courseware._id = :coursewareId', { coursewareId: courseId })
        .getOne();

      if (!course) {
        return errorResponse(res, 404, '课程不存在', null);
      }

      // 获取课件进度
      const progressBuilder = AppDataSource.getRepository(TrainingRecordProgress)
        .createQueryBuilder('progress')
        .where('progress.courseware_id = :coursewareId', { coursewareId: courseId })
        .andWhere('progress.training_record_participant_id = :partId', { partId: partId });
      
      let progressId = 0;
      let progress = await progressBuilder.getOne();

      if (!progress) {
        // 查询课程章节数
        const chapterCount = await AppDataSource.getRepository(CoursewareMaterial)
          .createQueryBuilder('coursewareMaterial')
          .where('coursewareMaterial.courseware_id = :coursewareId', { coursewareId: courseId })
          .getCount();

        const newProgress = new TrainingRecordProgress();
        newProgress.courseware_id = Number(courseId);
        newProgress.training_record_participant_id = Number(partId);
        newProgress.progress = 0;
        newProgress.chapter_count = chapterCount;
        progress = await AppDataSource.manager.save(newProgress);
      } 
      progressId = progress?.id || 0;

      // chapters
      const chaptersData = await AppDataSource.getRepository(CoursewareMaterial)
        .createQueryBuilder('coursewareMaterial')
        .innerJoinAndSelect('coursewareMaterial.material', 'material')
        .where('coursewareMaterial.courseware_id = :coursewareId', { coursewareId: courseId })
        .andWhere('material.is_deleted = :isDeleted', { isDeleted: 0 })
        .orderBy('coursewareMaterial.sort', 'ASC')
        .getMany();

      const chapterProgressMap = new Map<number, TrainingRecordProgressDetail>();
      if (progress) {
        const detailsBuilder = AppDataSource.getRepository(TrainingRecordProgressDetail)
          .createQueryBuilder('detail')
          .where('detail.training_record_progress_id = :progressId', { progressId: progressId })
        
        const details = await detailsBuilder.getMany();
        details.forEach(item => {
          chapterProgressMap.set(item.material_id, item);
        })
      }
      
      // console.log("chapterProgressMap", chapterProgressMap);
      // console.log("chaptersData", chaptersData);
      const chapters = chaptersData.map(item => ({
        id: item.material_id,
        title: item.material.title,
        duration: item.material.duration || 0,
        type: item.material.file_type,
        isCompleted: (chapterProgressMap.get(item.material_id)?.progress || 0) >= 100,
        isLocked: chapterProgressMap.get(item.material_id)?.is_locked === 1
      }))

      const formattedCourse = {
        id: courseId,
        title: course.title,
        subtitle: course.subtitle,
        cover: course.cover,
        duration: course.duration,
        studentCount: course.view_count,
        progress: progress?.progress || 0,
        progressId,
        isCompleted: (progress?.progress || 0) >= 100,
        // isFavorited: false,
        description: course.description,
        tags: [],
        objectives: [],
        chapters
      }

      return successResponse(res, {
        course: formattedCourse
      }, '获取课程详情成功');
    } catch (error) {
      logger.error('获取用户课程详情失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }    
  }

  // 获取用户相关课程
  async getRelatedCourses(req: Request, res: Response): Promise<Response> {
    try {
      const courseId = req.params.courseId;
      const courses = [] as Courseware[];
      return successResponse(res, {
        courses
      }, '获取相关课程成功');
    } catch (error) {
      logger.error('获取相关课程失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }  

  // 用户签到
  async signin(req: Request, res: Response): Promise<Response> {
    try {
      const user = (req as any).user;
      if (!user) {
        return errorResponse(res, 401, '未认证', null);
      }     
      const id = req.params.id;

      // 用户是否属于计划培训范围
      const scopes = await AppDataSource.getRepository(TrainingRecord)
        .createQueryBuilder('record')
        .innerJoin('record.training_plan', 'plan')
        .innerJoin('plan.scopes', 'scope')
        .select([
          'scope.branch_id',
          'scope.project_department_id',
          'scope.ref_type',
          'plan._id',
          'plan.assessment_method',
        ])
        .where('record.id = :recordId', { recordId: id })
        .getRawMany();

      let planId = 0;
      let hasExam = false;
      if (scopes.length > 0) {
        planId = scopes[0].plan__id || 0;
        hasExam = scopes[0].plan_assessment_method === 1;
      }
      if (planId === 0) {
        return errorResponse(res, 400, '用户不属于培训范围', null);
      }

      const userType = user.type === 2 ? 2 : 1;
      if (userType === 1) {
        const userBranch = await AppDataSource.getRepository(User)
          .createQueryBuilder('user')
          .where('user._id = :userId', { userId: user.id })
          .select('user.branch')
          .getRawOne();
        if (!scopes.some(item => item.branch_id === userBranch.branch)) {
          return errorResponse(res, 400, '用户不属于培训范围', null);
        }
      } else {
        const workerBranch = await AppDataSource.getRepository(ConstructionWorker)
          .createQueryBuilder('worker')
          .where('worker._id = :userId', { userId: user.id })
          .select([
            'worker.branch',
            'worker.project',
          ])
          .getRawOne();
        if (!scopes.some(item => item.branch_id === workerBranch.branch || item.project_department_id === workerBranch.project)) {
          return errorResponse(res, 400, '用户不属于培训范围', null);
        }
      }

      // 开始事务
      const queryRunner = AppDataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();
      
      try {
        const participantBuilder = queryRunner.manager
          .createQueryBuilder(TrainingRecordParticipant, 'participant')
          .where('participant.training_record_id = :recordId', { recordId: id })

        if (userType === 1) {
          participantBuilder.andWhere('participant.user_id = :userId', { userId: user.id });
        } else {
          participantBuilder.andWhere('participant.worker_id = :workerId', { workerId: user.id });
        }
        const participant = await participantBuilder.getOne();

        if (participant) {
          throw new Error('已签到');
        }

        // 查询培训记录课程数
        const courseCount = await queryRunner.manager
          .createQueryBuilder(TrainingRecordCourseware,'courseware')
          .where('courseware.training_record_id = :recordId', { recordId: id })
          .getCount();

        const newParticipant = new TrainingRecordParticipant();
        newParticipant.training_record_id = Number(id);
        if (userType === 1) {
          newParticipant.user_id = user.id;
        } else {
          newParticipant.worker_id = user.id;
        }
        newParticipant.is_signin = 1;
        newParticipant.course_count = courseCount;
        newParticipant.exam_count = hasExam ? 1 : 0;

        const savedParticipant = await queryRunner.manager.save(TrainingRecordParticipant, newParticipant);

        // 是否存在考试
        const exam = await queryRunner.manager
          .createQueryBuilder(Exam,'exam')
          .where('exam.training_record_id = :recordId', { recordId: id })
          .getOne();

        if (exam) {
          // 创建考试记录
          const examRecord = new ExamRecord();
          examRecord.training_record_id = Number(id);
          examRecord.exam_id = exam._id;
          examRecord.participant_id = savedParticipant.id;
          await queryRunner.manager.save(examRecord);
        }

        // 提交事务
        await queryRunner.commitTransaction();
        return successResponse(res, null, '签到成功');
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }
    } catch (error) {
      logger.error('签到失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 更新用户课程章节学习进度
  async updateChapterProgress(req: Request, res: Response): Promise<Response> {
    try {
      const user = (req as any).user;
      if (!user) {
        return errorResponse(res, 401, '未认证', null);
      }
      const chapterId = req.params.chapterId;
      const progress = req.body;
      const progressId = Number(progress.progressId) || 0;
      const isCompleted = Number(progress.progress) >= 100 ? true : false;
      if (progressId === 0) {
        return errorResponse(res, 400, '参数错误', null);
      }

      const progressEntity = await AppDataSource.getRepository(TrainingRecordProgressDetail)
        .createQueryBuilder('progress')
        .where('progress.training_record_progress_id = :progressId', { progressId: progressId })
        .andWhere('progress.material_id = :materialId', { materialId: chapterId })
        .getOne();

      if (!progressEntity) {
        const progressDetail = new TrainingRecordProgressDetail();
        progressDetail.training_record_progress_id = progressId;
        progressDetail.material_id = Number(chapterId);
        progressDetail.progress = Number(progress.progress);
        progressDetail.update_time = new Date();
        if (isCompleted) {
          progressDetail.end_time = new Date();
        }
        progressDetail.is_locked = 0;
        await AppDataSource.getRepository(TrainingRecordProgressDetail).save(progressDetail);
      } else {
        if (progressEntity.progress < 100) {
          progressEntity.progress = Number(progress.progress);
          progressEntity.update_time = new Date();
          if (isCompleted) {
            progressEntity.end_time = new Date();
          }
          await AppDataSource.getRepository(TrainingRecordProgressDetail).save(progressEntity);
        }
      }
      // 更新课件进度
      if (isCompleted) {
        const allProgress = await AppDataSource.getRepository(TrainingRecordProgressDetail)
        .createQueryBuilder('progress')
        .where('progress.training_record_progress_id = :progressId', { progressId })
        .select('progress.progress')
        .getRawMany();

        // 更新总进度
        const totalProgress = allProgress.reduce((acc, cur) => acc + cur.progress_progress, 0);
        const progressRecord = await AppDataSource.getRepository(TrainingRecordProgress)
          .createQueryBuilder('progress')
          .where('progress.id = :progressId', { progressId })
          .getOne();
        if (progressRecord) {
          let chapterCount = progressRecord.chapter_count;
          if (chapterCount === 0) chapterCount = allProgress.length;
          progressRecord.progress = Math.round(totalProgress / chapterCount * 100) / 100;
          await AppDataSource.getRepository(TrainingRecordProgress).save(progressRecord);

          // 更新用户整体进度
          if (progressRecord.progress >= 100) {
            const allCourseProgress = await AppDataSource.getRepository(TrainingRecordProgress)
            .createQueryBuilder('progress')
            .where('progress.training_record_participant_id = :participantId', { participantId: progressRecord.training_record_participant_id })
            .getMany();
            const totalCourseProgress = allCourseProgress.reduce((acc, cur) => acc + Number(cur.progress), 0);
            const participant = await AppDataSource.getRepository(TrainingRecordParticipant)
              .createQueryBuilder('participant')
              .where('participant.id = :participantId', { participantId: progressRecord.training_record_participant_id })
              .getOne();
            if (participant) {
              const courseProgress = Math.round(totalCourseProgress / ((participant.course_count || allCourseProgress.length) + (participant.exam_count || 0)) * 100) / 100;
              participant.progress = courseProgress;
              await AppDataSource.getRepository(TrainingRecordParticipant).save(participant);
            }
          }
        }
      }
      return successResponse(res, null, '更新课程章节学习进度成功');
    } catch (error) {
      logger.error('更新课程章节学习进度失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 完成用户课程章节
  async completeChapter(req: Request, res: Response): Promise<Response> {
    try {
      const user = (req as any).user;
      if (!user) {
        return errorResponse(res, 401, '未认证', null);
      }
      const chapterId = req.params.chapterId;
      const progressId = req.params.progressId;

      const progressEntity = await AppDataSource.getRepository(TrainingRecordProgressDetail)
        .createQueryBuilder('progress')
        .where('progress.training_record_progress_id = :progressId', { progressId: progressId })
        .andWhere('progress.material_id = :materialId', { materialId: chapterId })
        .getOne();
      if (!progressEntity) {
        return errorResponse(res, 404, '学习进度不存在', null);
      }
      progressEntity.progress = 100;
      progressEntity.end_time = new Date();
      progressEntity.update_time = new Date();

      await AppDataSource.getRepository(TrainingRecordProgressDetail).save(progressEntity);
      return successResponse(res, null, '完成课程章节成功');
    } catch (error) {
      logger.error('完成课程章节失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  /**
   * Exchange authorization code for access token using axios
   */
  private async exchangeCodeForToken(code: string): Promise<WechatTokenResponse | null> {
    try {
      const tokenUrl = 'https://api.weixin.qq.com/sns/oauth2/access_token';
      const params = {
        appid: WECHAT_CONFIG.appId,
        secret: WECHAT_CONFIG.appSecret,
        code: code,
        grant_type: WECHAT_CONFIG.grantType
      };
      
      logger.debug('Requesting WeChat access token:', { appid: params.appid, code: code.substring(0, 10) + '...' });
      
      const response = await axios.get(tokenUrl, {
        params,
        timeout: 10000
      });
      
      const data = response.data;
      
      // Check for WeChat API errors
      if (data.errcode) {
        logger.error('WeChat token exchange error:', { errcode: data.errcode, errmsg: data.errmsg });
        throw new Error(`WeChat API error: ${data.errmsg} (${data.errcode})`);
      }
      
      // Validate required fields
      if (!data.access_token || !data.openid) {
        logger.error('Invalid token response from WeChat:', data);
        throw new Error('Invalid token response from WeChat API');
      }
      
      logger.debug('Token exchange successful:', { openid: data.openid, expires_in: data.expires_in });
      
      return data;
    } catch (error) {
      logger.error('Error exchanging code for token:', error);
      throw error;
    }
  }

  /**
   * Exchange jscode for session (for miniprogram)
   */
  private async exchangeJscodeForSession(jscode: string): Promise<WechatSessionResponse | null> {
    try {
      const sessionUrl = 'https://api.weixin.qq.com/sns/jscode2session';
      const params = {
        appid: WECHAT_CONFIG.appId,
        secret: WECHAT_CONFIG.appSecret,
        js_code: jscode,
        grant_type: 'authorization_code'
      };
      
      logger.debug('Requesting WeChat session:', { appid: params.appid, js_code: jscode.substring(0, 10) + '...' });
      
      const response = await axios.get(sessionUrl, {
        params,
        timeout: 10000
      });
      
      const data = response.data;
      
      // Check for WeChat API errors
      if (data.errcode) {
        logger.error('WeChat jscode2session error:', { errcode: data.errcode, errmsg: data.errmsg });
        throw new Error(`WeChat API error: ${data.errmsg} (${data.errcode})`);
      }
      
      // Validate required fields
      if (!data.session_key || !data.openid) {
        logger.error('Invalid session response from WeChat:', data);
        throw new Error('Invalid session response from WeChat API');
      }
      
      logger.debug('Session exchange successful:', { openid: data.openid });
      
      return data;
    } catch (error) {
      logger.error('Error exchanging jscode for session:', error);
      throw error;
    }
  }

  /**
   * Get user information from WeChat API using axios
   */
  private async getWechatUserInfo(accessToken: string, openid: string): Promise<WechatUserInfo | null> {
    try {
      const userInfoUrl = 'https://api.weixin.qq.com/sns/userinfo';
      const params = {
        access_token: accessToken,
        openid: openid,
        lang: 'zh_CN'
      };
      
      logger.debug('Requesting WeChat user info:', { openid });
      
      const response = await axios.get(userInfoUrl, {
        params,
        timeout: 10000
      });
      
      const data = response.data;
      
      // Check for WeChat API errors
      if (data.errcode) {
        logger.warn('WeChat user info error (non-critical):', { errcode: data.errcode, errmsg: data.errmsg });
        // User info is optional, return null if fails
        return null;
      }
      
      logger.debug('User info retrieved successfully:', { openid: data.openid, nickname: data.nickname });
      
      return data;
    } catch (error) {
      logger.warn('Error getting WeChat user info (non-critical):', error);
      // User info is optional, return null if fails
      return null;
    }
  }

  /**
   * Find existing user or create new user
   */
  private async findUser(wechatData: {
    openid: string;
    unionid?: string;
    nickname?: string;
    avatar?: string;
    phone?: string;
    province?: string;
    city?: string;
    country?: string;
  }): Promise<any> {
    try {

      // 1, 先在 TrainingUser 中找
      let user;
      if (wechatData.phone) {
        user = await this.findTrainingUserByPhone(wechatData.phone);
        if (user) {
          return user;
        }
      }
      // 2, try to find user by openid
      user = await this.findUserByOpenid(wechatData.openid);
      if (user) {
        // Update user info if needed
        await this.updateUserInfo(user.id, {
          nickname: wechatData.nickname || user.nickname,
          avatar: wechatData.avatar || user.avatar,
          wechat_unionid: wechatData.unionid || user.wechat_unionid,
          province: wechatData.province || user.province,
          city: wechatData.city || user.city,
          country: wechatData.country || user.country
        });
        
        logger.info(`Existing user found and updated: ${user.id}`);
        return user;
      }
      
      // 3, If unionid exists, try to find by unionid
      if (wechatData.unionid) {
        user = await this.findUserByUnionid(wechatData.unionid);
        if (user) {
          // Link this openid to existing user
          await this.updateUserInfo(user.id, {
            wechat_openid: wechatData.openid,
            nickname: wechatData.nickname || user.nickname,
            avatar: wechatData.avatar || user.avatar
          });
          
          logger.info(`User found by unionid and linked: ${user.id}`);
          return user;
        }
      }
      return user;
    } catch (error) {
      logger.error('Error in findUser:', error);
      return null;
    }
  }

  private async findTrainingUserByPhone(phone: string): Promise<any> {
    try {
      const userRepository = AppDataSource.getRepository(TrainingUser);
      return await userRepository.findOne({ where: { phone } });
    } catch (error) {
      logger.error('Error finding user by phone:', error);
      return null;
    }
  }

  private async findUserByOpenid(openid: string): Promise<any> {
    try {
      const userRepository = AppDataSource.getRepository(TrainingUser);
      return await userRepository.findOne({ where: { wechat_openid: openid } });
    } catch (error) {
      logger.error('Error finding user by openid:', error);
      return null;
    }
  }

  private async findUserByUnionid(unionid: string): Promise<any> {
    try {
      const userRepository = AppDataSource.getRepository(TrainingUser);
      return await userRepository.findOne({ where: { wechat_unionid: unionid } });
    } catch (error) {
      logger.error('Error finding user by unionid:', error);
      throw error;
    }
  }

  private async updateUserInfo(userId: any, updateData: any): Promise<any> {
    try {
      const userRepository = AppDataSource.getRepository(TrainingUser);
      return await userRepository.update(userId, { ...updateData, updated_at: new Date() });
    } catch (error) {
      logger.error('Error updating user info:', error);
      throw error;
    }
  }

  /**
   * 生成用户 JWT 令牌
   */
  private generateJwtToken(user: any, type: string): string {

    const payload = {
      id: user.id,
      openid: user.wechat_openid,
      loginType: type,
      iat: Math.floor(Date.now() / 1000)
    };
    
    const options: jwt.SignOptions = {
      expiresIn: '7d' // Fixed expiration time
    };
    
    return jwt.sign(payload, JWT_SECRET, options);
  }

  /**
   * 绑定微信手机号
   */
  async bindWechatPhone(req: Request, res: Response): Promise<Response> {
    try {
      const { openid, unionid, phoneCode } = req.body;
      
      // 验证输入参数
      if (!openid) {
        return errorResponse(res, 400, '微信openid不能为空');
      }
      
      if (!phoneCode) {
        return errorResponse(res, 400, '手机号授权码不能为空');
      }
      
      logger.info(`开始绑定微信手机号，openid: ${openid.substring(0, 10)}..., phoneCode: ${phoneCode.substring(0, 10)}...`);
      
      // 构建微信用户信息
      const wechatUserInfo = {
        openid: openid,
        unionid: unionid,
        phone: phoneCode
      };
      
      // 2. 通过手机号授权码获取手机号
      const phoneInfo = await this.getWechatPhoneNumber(phoneCode);
      if (!phoneInfo) {
        return errorResponse(res, 400, '获取手机号失败');
      }
      
      // 3. 检查手机号是否在系统中登记
      // console.log('phoneInfo:', phoneInfo);
      const existingUser = await this.findUserByPhone(phoneInfo.phoneNumber);
      if (!existingUser) {
        return errorResponse(res, 400, '该手机号未在系统中登记');
      }
      
      // 4. 创建或更新用户信息
      let user = await this.findUser({
        openid: wechatUserInfo.openid,
        unionid: wechatUserInfo.unionid,
        phone: wechatUserInfo.phone
      });
      
      if (user) {
        // 更新现有用户的手机号
        await this.updateUserInfo(user.id, {
          phone: phoneInfo.phoneNumber,
          wechat_openid: wechatUserInfo.openid,
          wechat_unionid: wechatUserInfo.unionid,
          updated_at: new Date()
        });
      } else {
        // 创建新用户
        user = await this.createUserWithPhone({
          wechat_openid: wechatUserInfo.openid,
          wechat_unionid: wechatUserInfo.unionid,
          nickname: '微信用户_' + existingUser.phoneNumber,
          id: existingUser.global_id,
          realname: existingUser.realname,
          type: existingUser.type,
          phone: phoneInfo.phoneNumber
        });
      }
      
      // 生成JWT token
      const token = this.generateJwtToken(user, 'wechat');
      
      logger.info(`微信手机号绑定成功，用户ID: ${user.id}`);
      
      return successResponse(res, {
        token,
        userInfo: {
          id: user.id,
          username: user.username || user.nickname,
          nickname: user.nickname,
          avatar: user.avatar,
          phone: phoneInfo.phoneNumber,
          openid: wechatUserInfo.openid,
          loginType: 'wechat'
        }
      }, '手机号绑定成功');
      
    } catch (error) {
      logger.error('微信手机号绑定失败:', error);
      
      // if (error?.response?.data?.errcode) {
      //   const errcode = error.response.data.errcode;
      //   const errmsg = error.response.data.errmsg || '微信API调用失败';
        
      //   if (errcode === 40029) {
      //     return errorResponse(res, 400, '授权码无效');
      //   } else if (errcode === 40163) {
      //     return errorResponse(res, 400, '授权码已使用');
      //   } else {
      //     return errorResponse(res, 400, `微信API错误: ${errmsg}`);
      //   }
      // }
      
      return errorResponse(res, 500, '手机号绑定失败');
    }
  }
  
  /**
   * 获取微信手机号
   */
  private async getWechatPhoneNumber(code: string): Promise<{ phoneNumber: string } | null> {
    try {
      // 获取access_token
      const tokenResponse = await axios.get('https://api.weixin.qq.com/cgi-bin/token', {
        params: {
          grant_type: 'client_credential',
          appid: WECHAT_CONFIG.appId,
          secret: WECHAT_CONFIG.appSecret
        }
      });
      
      if (tokenResponse.data.errcode) {
        logger.error('获取微信access_token失败:', tokenResponse.data);
        return null;
      }
      
      const accessToken = tokenResponse.data.access_token;
      
      // 获取手机号
      const phoneResponse = await axios.post(
        `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${accessToken}`,
        { code }
      );
      
      if (phoneResponse.data.errcode !== 0) {
        logger.error('获取微信手机号失败:', phoneResponse.data);
        return null;
      }
      
      return {
        phoneNumber: phoneResponse.data.phone_info.phoneNumber
      };
      
    } catch (error) {
      logger.error('获取微信手机号异常:', error);
      return null;
    }
  }
  
  /**
   * 根据手机号查找用户
   */
  private async findUserByPhone(phone: string): Promise<any> {
    try {
      // 先查找User表
      const user = await AppDataSource.getRepository(User)
        .findOne({ where: { phone } });
      
      if (user) {
        return {
          global_id: user._id,
          realname: user.realname,
          branch_id: user.branch,
          project_id: 0,
          type: 1
        };
      }
      
      // 再查找ConstructionWorker表
      const worker = await AppDataSource.getRepository(ConstructionWorker)
        .findOne({ where: { phone } });
      
      if (worker) {
        return {
          global_id: worker._id,
          realname: worker.name,
          branch_id: worker.branch,
          project_id: worker.project,
          type: 2
        };
      }
      
      return null;
    } catch (error) {
      logger.error('根据手机号查找用户失败:', error);
      return null;
    }
  }
  
  /**
   * 创建带手机号的用户
   */
  private async createUserWithPhone(userData: any): Promise<any> {
    try {
      const userRepository = AppDataSource.getRepository(TrainingUser);
      
      const newUser = userRepository.create({
        id: userData.id,
        global_id: userData.global_id,
        name: userData.phone,
        realname: userData.realname,
        type: userData.type,
        nickname: userData.nickname,
        phone: userData.phone,
        avatar: userData.avatar || null,
        wechat_openid: userData.wechat_openid,
        wechat_unionid: userData.wechat_unionid,
        province: userData.province || null,
        city: userData.city || null,
        country: userData.country || null,
        is_deleted: 0,
        created_at: new Date(),
        updated_at: new Date()
      });
      
      const savedUser = await userRepository.save(newUser);
      return { ...savedUser, type: 'training_user' };
      
    } catch (error) {
      logger.error('创建用户失败:', error);
      throw error;
    }
  }
}