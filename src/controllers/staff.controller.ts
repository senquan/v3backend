import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Staff, StaffStatus } from '../models/staff.model';
import { Role } from '../models/role.model';
import { User } from '../models/user.model';
import { logger } from '../utils/logger';
import { errorResponse, successResponse } from '../utils/response';
import { Not } from 'typeorm';

export class StaffController {
  // 创建员工
  async create(req: Request, res: Response): Promise<Response> {
    try {
      const { 
        name, 
        staffNo,
        phone,
        email,
        userId,
        position,
        department,
        hireDate,
        gender,
        remark
      } = req.body;

      // 验证必要字段
      if (!name) {
        return errorResponse(res, 400, '员工姓名不能为空', null);
      }

      // 验证手机号格式
      if (phone && !/^1[3-9]\d{9}$/.test(phone)) {
        return errorResponse(res, 400, '无效的手机号格式', null);
      }

      // 验证邮箱格式
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return errorResponse(res, 400, '无效的邮箱格式', null);
      }

      // 检查手机号是否已存在
      if (phone) {
        const existingStaff = await AppDataSource.getRepository(Staff).findOne({
          where: { phone, isDeleted: 0 }
        });

        if (existingStaff) {
          return errorResponse(res, 400, '该手机号已被注册', null);
        }
      }

      // 检查工号是否已存在
      if (staffNo) {
        const existingStaff = await AppDataSource.getRepository(Staff).findOne({
          where: { staffNo, isDeleted: 0 }
        });

        if (existingStaff) {
          return errorResponse(res, 400, '该工号已被使用', null);
        }
      }

      // 创建员工
      const staff = new Staff();
      staff.name = name;
      staff.staffNo = staffNo || null;
      staff.phone = phone || null;
      staff.email = email || null;
      staff.position = position || null;
      staff.department = department || null;
      staff.managerId = null;
      staff.baseSalary =null;
      staff.address = null;
      staff.idCard = null;
      staff.remark = remark || null;
      staff.status =StaffStatus.ACTIVE;
      staff.avatar = null;
      staff.emergencyContact = null;
      staff.emergencyPhone = null;
      
      // 处理日期字段
      if (hireDate) {
        staff.hireDate = new Date(hireDate);
      }
      
      if (gender) {
        staff.gender = gender;
      }

      if (userId) {
        const existingUser = await AppDataSource.getRepository(User).findOne({
          where: { id: userId },
          relations: ['staff']
        });

        if (existingUser && existingUser.staff) {
          return errorResponse(res, 400, '该用户已被其他员工绑定', null);
        } else {
          staff.user = existingUser;
        }
      }

      // 保存员工
      const savedStaff = await AppDataSource.getRepository(Staff).save(staff);
      
      return successResponse(res, savedStaff, '创建员工成功');

    } catch (error) {
      logger.error('创建员工失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 获取员工列表
  async getList(req: Request, res: Response): Promise<Response> {
    try {
      const { 
        page = 1, 
        pageSize = 20, 
        role,
        status,
        department,
        keyword,
        managerId
      } = req.query;
      
      const queryBuilder = AppDataSource.getRepository(Staff)
        .createQueryBuilder('staff')
        .leftJoinAndSelect('staff.manager', 'manager')
        .leftJoinAndSelect('staff.user', 'user')
        .where('staff.isDeleted = :isDeleted', { isDeleted: 0 });

      // 添加查询条件
      if (role !== undefined) {
        queryBuilder.andWhere('staff.role = :role', { role });
      }
      
      if (status !== undefined) {
        queryBuilder.andWhere('staff.status = :status', { status });
      }
      
      if (department) {
        queryBuilder.andWhere('staff.department = :department', { department });
      }
      
      if (managerId !== undefined) {
        queryBuilder.andWhere('staff.managerId = :managerId', { managerId });
      }
      
      if (keyword) {
        queryBuilder.andWhere(
          '(staff.name LIKE :keyword OR staff.staffNo LIKE :keyword OR staff.phone LIKE :keyword OR staff.email LIKE :keyword)', 
          { keyword: `%${keyword}%` }
        );
      }

      // 分页查询
      const [staffs, total] = await queryBuilder
        .orderBy('staff.createAt', 'DESC')
        .skip((Number(page) - 1) * Number(pageSize))
        .take(Number(pageSize))
        .getManyAndCount();

      // 获取所有角色
      const roles = await AppDataSource.getRepository(Role).find(
        { where: { isDeleted: 0 } }
      );

      return successResponse(res, {
        staffs,
        roles,
        total,
        page: Number(page),
        pageSize: Number(pageSize)
      }, '获取员工列表成功');

    } catch (error) {
      logger.error('获取员工列表失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 获取员工详情
  async getDetail(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      
      const staff = await AppDataSource.getRepository(Staff)
        .createQueryBuilder('staff')
        .leftJoinAndSelect('staff.manager', 'manager')
        .leftJoinAndSelect('staff.subordinates', 'subordinates', 'subordinates.isDeleted = 0')
        .leftJoinAndSelect('staff.customers', 'customers', 'customers.isDeleted = 0')
        .where('staff.id = :id', { id })
        .andWhere('staff.isDeleted = :isDeleted', { isDeleted: 0 })
        .getOne();

      if (!staff) {
        return errorResponse(res, 404, '员工不存在', null);
      }

      return successResponse(res, staff, '获取员工详情成功');
    } catch (error) {
      logger.error('获取员工详情失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 更新员工
  async update(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { 
        name, 
        staffNo,
        phone,
        email,
        userId,
        position,
        department,
        hireDate,
        resignDate,
        address,
        gender,
        remark,
        status
      } = req.body;

      // 查找员工
      const staff = await AppDataSource.getRepository(Staff)
        .findOne({
          where: { id: Number(id), isDeleted: 0 },
          relations: ['user']
        });

      if (!staff) {
        return errorResponse(res, 404, '员工不存在', null);
      }

      // 验证手机号是否被其他员工使用
      if (phone && phone !== staff.phone) {
        const existingStaff = await AppDataSource.getRepository(Staff).findOne({
          where: { phone, isDeleted: 0, id: Not(Number(id)) }
        });

        if (existingStaff) {
          return errorResponse(res, 400, '该手机号已被其他员工使用', null);
        }
      }

      // 验证工号是否被其他员工使用
      if (staffNo && staffNo !== staff.staffNo) {
        const existingStaff = await AppDataSource.getRepository(Staff).findOne({
          where: { staffNo, isDeleted: 0, id: Not(Number(id)) }
        });

        if (existingStaff) {
          return errorResponse(res, 400, '该工号已被其他员工使用', null);
        }
      }

      // 更新员工信息
      if (name) staff.name = name;
      if (staffNo !== undefined) staff.staffNo = staffNo;
      if (phone !== undefined) staff.phone = phone;
      if (email !== undefined) staff.email = email;
      if (position !== undefined) staff.position = position;
      if (department !== undefined) staff.department = department;
      if (address !== undefined) staff.address = address;
      if (remark !== undefined) staff.remark = remark;
      if (status) staff.status = status;
      
      // 处理日期字段
      if (hireDate) {
        staff.hireDate = new Date(hireDate);
      }
      
      if (resignDate) {
        staff.resignDate = new Date(resignDate);
        
        // 如果设置了离职日期，自动更新状态为离职
        if (status === undefined) {
          staff.status = StaffStatus.RESIGNED;
        }
      }
      
      if (gender !== undefined) {
        staff.gender = gender;
      }

      if (userId !== staff.userId) {
        const existingUser = await AppDataSource.getRepository(User).findOne({
          where: { id: userId },
          relations: ['staff']
        });

        if (existingUser && existingUser.staff) {
          return errorResponse(res, 400, '该用户已被其他员工绑定', null);
        } else {
          staff.user = existingUser;
        }
      }

      // 保存员工更新
      const updatedStaff = await AppDataSource.getRepository(Staff).save(staff);
      
      return successResponse(res, updatedStaff, '更新员工成功');

    } catch (error) {
      logger.error('更新员工失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 删除员工（软删除）
  async delete(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      
      // 检查是否有下属员工
      const subordinatesCount = await AppDataSource.getRepository(Staff)
        .count({
          where: { managerId: Number(id), isDeleted: 0 }
        });
      
      if (subordinatesCount > 0) {
        return errorResponse(res, 400, '该员工有下属员工，无法删除', null);
      }
      
      // 检查是否有关联的客户
      const customersCount = await AppDataSource.getRepository('Customer')
        .count({
          where: { salesRepId: Number(id), isDeleted: 0 }
        });
      
      if (customersCount > 0) {
        return errorResponse(res, 400, '该员工有关联的客户，无法删除', null);
      }
      
      const result = await AppDataSource.getRepository(Staff)
        .update({ id: Number(id), isDeleted: 0 }, { isDeleted: 1 });

      if (result.affected === 0) {
        return errorResponse(res, 404, '员工不存在', null);
      }

      return successResponse(res, null, '删除员工成功');
    } catch (error) {
      logger.error('删除员工失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 更新员工状态
  async updateStatus(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { status } = req.body;

      // 验证员工状态
      if (!Object.values(StaffStatus).includes(status)) {
        return errorResponse(res, 400, '无效的员工状态', null);
      }

      // 更新员工状态
      const result = await AppDataSource.getRepository(Staff)
        .update({ id: Number(id), isDeleted: 0 }, { status });

      if (result.affected === 0) {
        return errorResponse(res, 404, '员工不存在', null);
      }

      return successResponse(res, null, '更新员工状态成功');
    } catch (error) {
      logger.error('更新员工状态失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 获取部门列表
  async getDepartments(req: Request, res: Response): Promise<Response> {
    try {
      const departments = await AppDataSource.getRepository(Staff)
        .createQueryBuilder('staff')
        .select('DISTINCT staff.department', 'department')
        .where('staff.isDeleted = :isDeleted', { isDeleted: 0 })
        .andWhere('staff.department IS NOT NULL')
        .getRawMany();

      return successResponse(res, departments.map(item => item.department), '获取部门列表成功');
    } catch (error) {
      logger.error('获取部门列表失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 获取员工统计信息
  async getStatistics(req: Request, res: Response): Promise<Response> {
    try {
      // 获取员工总数
      const totalCount = await AppDataSource.getRepository(Staff)
        .count({ where: { isDeleted: 0 } });

      // 按角色统计员工数量
      const roleStats = await AppDataSource.getRepository(Staff)
        .createQueryBuilder('staff')
        .select('staff.role', 'role')
        .addSelect('COUNT(staff.id)', 'count')
        .where('staff.isDeleted = :isDeleted', { isDeleted: 0 })
        .groupBy('staff.role')
        .getRawMany();

      // 按状态统计员工数量
      const statusStats = await AppDataSource.getRepository(Staff)
        .createQueryBuilder('staff')
        .select('staff.status', 'status')
        .addSelect('COUNT(staff.id)', 'count')
        .where('staff.isDeleted = :isDeleted', { isDeleted: 0 })
        .groupBy('staff.status')
        .getRawMany();

      // 按部门统计员工数量
      const departmentStats = await AppDataSource.getRepository(Staff)
        .createQueryBuilder('staff')
        .select('staff.department', 'department')
        .addSelect('COUNT(staff.id)', 'count')
        .where('staff.isDeleted = :isDeleted', { isDeleted: 0 })
        .andWhere('staff.department IS NOT NULL')
        .groupBy('staff.department')
        .getRawMany();

      // 获取最近入职的员工
      const recentHires = await AppDataSource.getRepository(Staff)
        .find({
          where: { isDeleted: 0 },
          order: { hireDate: 'DESC' },
          take: 5
        });

      return successResponse(res, {
        totalCount,
        roleStats,
        statusStats,
        departmentStats,
        recentHires
      }, '获取员工统计信息成功');
    } catch (error) {
      logger.error('获取员工统计信息失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 获取组织架构
//   async getOrganizationStructure(req: Request, res: Response): Promise<Response> {
//     try {
//       // 获取所有员工
//       const allStaff = await AppDataSource.getRepository(Staff)
//         .find({
//           where: { isDeleted: 0 },
//           select: ['id', 'name', 'position', 'department', 'managerId']
//         });

//       // 构建组织架构树
//       const buildOrgTree = (managerId: number | null) => {
//         return allStaff
//           .filter(staff => staff.managerId === managerId)
//           .map(staff => ({
//             id: staff.id,
//             name: staff.name,
//             position: staff.position,
//             department: staff.department,
//             children: buildOrgTree(staff.id)
//           }));
//       };

//       // 获取顶级管理者（没有上级的员工）
//       const orgStructure = buildOrgTree(null);

//       return successResponse(res, orgStructure, '获取组织架构成功');
//     } catch (error) {
//       logger.error('获取组织架构失败:', error);
//       return errorResponse(res, 500, '服务器内部错误', null);
//     }
//   }
}