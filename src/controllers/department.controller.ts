import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Department } from '../models/department.model';
import { Staff } from '../models/staff.model';
import { logger } from '../utils/logger';
import { errorResponse, successResponse } from '../utils/response';

export class DepartmentController {
  // 获取部门树形列表
  async getTree(req: Request, res: Response): Promise<Response> {
    try {
      const departments = await AppDataSource.getRepository(Department)
        .createQueryBuilder('dept')
        .leftJoinAndSelect('dept.children', 'children')
        .where('dept.isDeleted = :isDeleted', { isDeleted: 0 })
        .orderBy('dept.sort', 'ASC')
        .addOrderBy('dept.id', 'ASC')
        .getMany();

      // 递归构建树形结构（只取顶级部门，子部门通过 relations 自动加载）
      const topLevel = departments.filter(d => d.parentId === 0);

      // 统计每个部门的成员数
      const memberCounts = await AppDataSource.getRepository(Staff)
        .createQueryBuilder('staff')
        .select('staff.departmentId', 'deptId')
        .addSelect('COUNT(staff.id)', 'count')
        .where('staff.isDeleted = :isDeleted', { isDeleted: 0 })
        .andWhere('staff.departmentId IS NOT NULL')
        .groupBy('staff.departmentId')
        .getRawMany();

      const countMap: Record<number, number> = {};
      memberCounts.forEach(item => {
        countMap[Number(item.deptId)] = Number(item.count);
      });

      // 递归添加成员数
      const addMemberCount = (depts: Department[]): any[] => {
        return depts.map(dept => ({
          ...dept,
          memberCount: countMap[dept.id] || 0,
          children: dept.children ? addMemberCount(dept.children) : []
        }));
      };

      return successResponse(res, addMemberCount(topLevel), '获取部门树成功');
    } catch (error) {
      logger.error('获取部门树失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 获取部门详情
  async getDetail(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;

      const dept = await AppDataSource.getRepository(Department).findOne({
        where: { id: Number(id), isDeleted: 0 }
      });

      if (!dept) {
        return errorResponse(res, 404, '部门不存在', null);
      }

      return successResponse(res, dept, '获取部门详情成功');
    } catch (error) {
      logger.error('获取部门详情失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 创建部门
  async create(req: Request, res: Response): Promise<Response> {
    try {
      const { name, parentId = 0, sort = 0 } = req.body;

      if (!name) {
        return errorResponse(res, 400, '部门名称不能为空', null);
      }

      // 检查同级下是否有同名部门
      const existing = await AppDataSource.getRepository(Department).findOne({
        where: { name, parentId: Number(parentId), isDeleted: 0 }
      });

      if (existing) {
        return errorResponse(res, 400, '同级下已存在同名部门', null);
      }

      // 如果指定了父部门，检查是否存在
      if (parentId > 0) {
        const parent = await AppDataSource.getRepository(Department).findOne({
          where: { id: Number(parentId), isDeleted: 0 }
        });
        if (!parent) {
          return errorResponse(res, 400, '上级部门不存在', null);
        }
      }

      const dept = new Department();
      dept.name = name;
      dept.parentId = Number(parentId);
      dept.sort = Number(sort);
      dept.isActive = 1;

      const saved = await AppDataSource.getRepository(Department).save(dept);
      return successResponse(res, saved, '创建部门成功');
    } catch (error) {
      logger.error('创建部门失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 更新部门
  async update(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { name, parentId, sort, isActive } = req.body;

      const dept = await AppDataSource.getRepository(Department).findOne({
        where: { id: Number(id), isDeleted: 0 }
      });

      if (!dept) {
        return errorResponse(res, 404, '部门不存在', null);
      }

      // 不能将自己设为自己的上级
      if (parentId !== undefined && Number(parentId) === dept.id) {
        return errorResponse(res, 400, '不能将部门设为自己的上级', null);
      }

      // 检查同级下是否有同名部门（排除自身）
      if (name && name !== dept.name) {
        const existing = await AppDataSource.getRepository(Department)
          .createQueryBuilder('dept')
          .where('dept.name = :name', { name })
          .andWhere('dept.parentId = :parentId', { parentId: parentId ?? dept.parentId })
          .andWhere('dept.id != :id', { id: dept.id })
          .andWhere('dept.isDeleted = 0')
          .getOne();

        if (existing) {
          return errorResponse(res, 400, '同级下已存在同名部门', null);
        }
      }

      if (name !== undefined) dept.name = name;
      if (parentId !== undefined) dept.parentId = Number(parentId);
      if (sort !== undefined) dept.sort = Number(sort);
      if (isActive !== undefined) dept.isActive = Number(isActive);

      const updated = await AppDataSource.getRepository(Department).save(dept);
      return successResponse(res, updated, '更新部门成功');
    } catch (error) {
      logger.error('更新部门失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 删除部门（软删除）
  async delete(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;

      const dept = await AppDataSource.getRepository(Department).findOne({
        where: { id: Number(id), isDeleted: 0 }
      });

      if (!dept) {
        return errorResponse(res, 404, '部门不存在', null);
      }

      // 检查是否有子部门
      const childCount = await AppDataSource.getRepository(Department).count({
        where: { parentId: dept.id, isDeleted: 0 }
      });

      if (childCount > 0) {
        return errorResponse(res, 400, '请先删除或移动子部门', null);
      }

      // 检查是否有成员
      const memberCount = await AppDataSource.getRepository(Staff).count({
        where: { departmentId: dept.id, isDeleted: 0 }
      });

      if (memberCount > 0) {
        return errorResponse(res, 400, '请先将部门成员调离或移除部门', null);
      }

      dept.isDeleted = 1;
      await AppDataSource.getRepository(Department).save(dept);

      return successResponse(res, null, '删除部门成功');
    } catch (error) {
      logger.error('删除部门失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 获取部门成员列表
  async getMembers(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { page = 1, pageSize = 20 } = req.query;

      const dept = await AppDataSource.getRepository(Department).findOne({
        where: { id: Number(id), isDeleted: 0 }
      });

      if (!dept) {
        return errorResponse(res, 404, '部门不存在', null);
      }

      const [staffs, total] = await AppDataSource.getRepository(Staff)
        .createQueryBuilder('staff')
        .leftJoinAndSelect('staff.dept', 'dept')
        .where('staff.departmentId = :deptId', { deptId: dept.id })
        .andWhere('staff.isDeleted = :isDeleted', { isDeleted: 0 })
        .orderBy('staff.createAt', 'DESC')
        .skip((Number(page) - 1) * Number(pageSize))
        .take(Number(pageSize))
        .getManyAndCount();

      return successResponse(res, {
        department: dept,
        staffs,
        total,
        page: Number(page),
        pageSize: Number(pageSize)
      }, '获取部门成员成功');
    } catch (error) {
      logger.error('获取部门成员失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 将成员移入部门
  async addMembers(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { staffIds } = req.body;

      if (!Array.isArray(staffIds) || staffIds.length === 0) {
        return errorResponse(res, 400, '请选择要添加的成员', null);
      }

      const dept = await AppDataSource.getRepository(Department).findOne({
        where: { id: Number(id), isDeleted: 0 }
      });

      if (!dept) {
        return errorResponse(res, 404, '部门不存在', null);
      }

      await AppDataSource.getRepository(Staff)
        .createQueryBuilder()
        .update(Staff)
        .set({ departmentId: dept.id })
        .whereInIds(staffIds)
        .andWhere('isDeleted = :isDeleted', { isDeleted: 0 })
        .execute();

      return successResponse(res, null, `已将 ${staffIds.length} 名成员移入部门`);
    } catch (error) {
      logger.error('添加部门成员失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 将成员移出部门
  async removeMembers(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { staffIds } = req.body;

      if (!Array.isArray(staffIds) || staffIds.length === 0) {
        return errorResponse(res, 400, '请选择要移除的成员', null);
      }

      await AppDataSource.getRepository(Staff)
        .createQueryBuilder()
        .update(Staff)
        .set({ departmentId: null })
        .whereInIds(staffIds)
        .andWhere('departmentId = :deptId', { deptId: Number(id) })
        .execute();

      return successResponse(res, null, `已将 ${staffIds.length} 名成员移出部门`);
    } catch (error) {
      logger.error('移除部门成员失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
}

