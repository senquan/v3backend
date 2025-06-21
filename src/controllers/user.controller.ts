import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { ConstructionWorker } from '../models/entities/ConstructionWorker.entity';
import { User } from '../models/entities/User.entity';
import { ProjectDepartmentMember } from '../models/entities/ProjectDepartmentMember.entity';
import { logger } from '../utils/logger';
import { errorResponse, successResponse } from '../utils/response';

export class UserController {
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
}