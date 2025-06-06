import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Customer, CustomerType, CustomerLevel } from '../models/customer.model';
import { logger } from '../utils/logger';
import { errorResponse, successResponse } from '../utils/response';
import { Like, IsNull, Not } from 'typeorm';

export class CustomerController {
  // 创建客户
  async create(req: Request, res: Response): Promise<Response> {
    try {
      const { 
        name, 
        type, 
        code,
        phone,
        email,
        address,
        cityId,
        provinceId,
        districtId,
        postalCode,
        country,
        contactPerson,
        contactPhone,
        contactPosition,
        level,
        companyName,
        taxNumber,
        remark,
        salesRepId
      } = req.body;

      // 验证必要字段
      if (!name) {
        return errorResponse(res, 400, '客户名称不能为空', null);
      }

      // 验证客户类型
      if (type && !Object.values(CustomerType).includes(type)) {
        return errorResponse(res, 400, '无效的客户类型', null);
      }

      // 验证客户等级
      if (level && !Object.values(CustomerLevel).includes(level)) {
        return errorResponse(res, 400, '无效的客户等级', null);
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
        const existingCustomer = await AppDataSource.getRepository(Customer).findOne({
          where: { phone, isDeleted: 0 }
        });

        if (existingCustomer) {
          return errorResponse(res, 400, '该手机号已被注册', null);
        }
      }

      // 创建客户
      const customer = new Customer();
      customer.name = name;
      customer.type = type || CustomerType.INDIVIDUAL;
      customer.code = code || null;
      customer.phone = phone || null;
      customer.email = email || null;
      customer.address = address || null;
      customer.cityId = cityId || 0;
      customer.provinceId = provinceId || 0;
      customer.districtId = districtId || 0;
      customer.postalCode = postalCode || null;
      customer.country = country || null;
      customer.contactPerson = contactPerson || null;
      customer.contactPhone = contactPhone || null;
      customer.contactPosition = contactPosition || null;
      customer.level = level || CustomerLevel.REGULAR;
      customer.companyName = companyName || null;
      customer.taxNumber = taxNumber || null;
      customer.remark = remark || null;
      customer.salesRepId = salesRepId || (req as any).user.id;

      // 保存客户
      const savedCustomer = await AppDataSource.getRepository(Customer).save(customer);
      
      return successResponse(res, savedCustomer, '创建客户成功');

    } catch (error) {
      logger.error('创建客户失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 获取客户列表
  async getList(req: Request, res: Response): Promise<Response> {
    try {
      const { 
        page = 1, 
        pageSize = 20, 
        type,
        level,
        keyword,
        salesRepId,
        isActive
      } = req.query;
      
      const queryBuilder = AppDataSource.getRepository(Customer)
        .createQueryBuilder('customer')
        .where('customer.isDeleted = :isDeleted', { isDeleted: 0 });

      // 添加查询条件
      if (type) {
        queryBuilder.andWhere('customer.type = :type', { type });
      }
      
      if (level !== undefined) {
        queryBuilder.andWhere('customer.level = :level', { level });
      }
      
      if (salesRepId !== undefined) {
        queryBuilder.andWhere('customer.salesRepId = :salesRepId', { salesRepId });
      }
      
      if (isActive !== undefined) {
        queryBuilder.andWhere('customer.isActive = :isActive', { isActive });
      }
      
      if (keyword) {
        queryBuilder.andWhere(
          '(customer.name LIKE :keyword OR customer.phone LIKE :keyword OR customer.email LIKE :keyword OR customer.companyName LIKE :keyword)', 
          { keyword: `%${keyword}%` }
        );
      }

      const pageNum = Number(page);
      const pageSizeNum = Number(pageSize);

      // 分页查询
      const [customers, total] = await queryBuilder
        .orderBy('customer.created_at', 'DESC')
        .skip((pageNum - 1) * pageSizeNum)
        .take(pageSizeNum)
        .getManyAndCount();

      return successResponse(res, {
        customers,
        total,
        page: pageNum,
        pageSize: pageSizeNum
      }, '获取客户列表成功');

    } catch (error) {
      logger.error('获取客户列表失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 获取客户详情
  async getDetail(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      
      const customer = await AppDataSource.getRepository(Customer)
        .createQueryBuilder('customer')
        .leftJoinAndSelect('customer.orders', 'orders', 'orders.isDeleted = 0')
        .where('customer.id = :id', { id })
        .andWhere('customer.isDeleted = :isDeleted', { isDeleted: 0 })
        .getOne();

      if (!customer) {
        return errorResponse(res, 404, '客户不存在', null);
      }

      return successResponse(res, customer, '获取客户详情成功');
    } catch (error) {
      logger.error('获取客户详情失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 更新客户
  async update(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { 
        name, 
        type, 
        code,
        phone,
        email,
        address,
        cityId,
        provinceId,
        districtId,
        postalCode,
        country,
        contactPerson,
        contactPhone,
        contactPosition,
        level,
        companyName,
        taxNumber,
        remark,
        salesRepId,
        isActive
      } = req.body;

      // 查找客户
      const customer = await AppDataSource.getRepository(Customer)
        .findOne({
          where: { id: Number(id), isDeleted: 0 }
        });

      if (!customer) {
        return errorResponse(res, 404, '客户不存在', null);
      }

      // 验证手机号是否被其他客户使用
      if (phone && phone !== customer.phone) {
        const existingCustomer = await AppDataSource.getRepository(Customer).findOne({
          where: { phone, isDeleted: 0, id: Not(Number(id)) }
        });

        if (existingCustomer) {
          return errorResponse(res, 400, '该手机号已被其他客户使用', null);
        }
      }

      // 更新客户信息
      if (name) customer.name = name;
      if (type) customer.type = type;
      if (code !== undefined) customer.code = code;
      if (phone !== undefined) customer.phone = phone;
      if (email !== undefined) customer.email = email;
      if (address !== undefined) customer.address = address;
      if (cityId !== undefined) customer.cityId = cityId;
      if (provinceId !== undefined) customer.provinceId = provinceId;
      if (districtId!== undefined) customer.districtId = districtId;
      if (postalCode !== undefined) customer.postalCode = postalCode;
      if (country !== undefined) customer.country = country;
      if (contactPerson !== undefined) customer.contactPerson = contactPerson;
      if (contactPhone !== undefined) customer.contactPhone = contactPhone;
      if (contactPosition !== undefined) customer.contactPosition = contactPosition;
      if (level) customer.level = level;
      if (companyName !== undefined) customer.companyName = companyName;
      if (taxNumber !== undefined) customer.taxNumber = taxNumber;
      if (remark !== undefined) customer.remark = remark;
      if (salesRepId !== undefined) customer.salesRepId = salesRepId;
      if (isActive !== undefined) customer.isActive = isActive;

      // 保存客户更新
      const updatedCustomer = await AppDataSource.getRepository(Customer).save(customer);
      
      return successResponse(res, updatedCustomer, '更新客户成功');

    } catch (error) {
      logger.error('更新客户失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 删除客户（软删除）
  async delete(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      
      const result = await AppDataSource.getRepository(Customer)
        .update({ id: Number(id), isDeleted: 0 }, { isDeleted: 1 });

      if (result.affected === 0) {
        return errorResponse(res, 404, '客户不存在', null);
      }

      return successResponse(res, null, '删除客户成功');
    } catch (error) {
      logger.error('删除客户失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 更新客户等级
  async updateLevel(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { level } = req.body;

      // 验证客户等级
      if (!Object.values(CustomerLevel).includes(level)) {
        return errorResponse(res, 400, '无效的客户等级', null);
      }

      // 更新客户等级
      const result = await AppDataSource.getRepository(Customer)
        .update({ id: Number(id), isDeleted: 0 }, { level });

      if (result.affected === 0) {
        return errorResponse(res, 404, '客户不存在', null);
      }

      return successResponse(res, null, '更新客户等级成功');
    } catch (error) {
      logger.error('更新客户等级失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 获取客户统计信息
  async getStatistics(req: Request, res: Response): Promise<Response> {
    try {
      // 获取客户总数
      const totalCount = await AppDataSource.getRepository(Customer)
        .count({ where: { isDeleted: 0 } });

      // 按类型统计客户数量
      const typeStats = await AppDataSource.getRepository(Customer)
        .createQueryBuilder('customer')
        .select('customer.type', 'type')
        .addSelect('COUNT(customer.id)', 'count')
        .where('customer.isDeleted = :isDeleted', { isDeleted: 0 })
        .groupBy('customer.type')
        .getRawMany();

      // 按等级统计客户数量
      const levelStats = await AppDataSource.getRepository(Customer)
        .createQueryBuilder('customer')
        .select('customer.level', 'level')
        .addSelect('COUNT(customer.id)', 'count')
        .where('customer.isDeleted = :isDeleted', { isDeleted: 0 })
        .groupBy('customer.level')
        .getRawMany();

      // 获取最近注册的客户
      const recentCustomers = await AppDataSource.getRepository(Customer)
        .find({
          where: { isDeleted: 0 },
          order: { createdAt: 'DESC' },
          take: 5
        });

      // 获取消费最多的客户
      const topSpenders = await AppDataSource.getRepository(Customer)
        .find({
          where: { isDeleted: 0 },
          order: { totalSpent: 'DESC' },
          take: 5
        });

      return successResponse(res, {
        totalCount,
        typeStats,
        levelStats,
        recentCustomers,
        topSpenders
      }, '获取客户统计信息成功');
    } catch (error) {
      logger.error('获取客户统计信息失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 更新客户消费统计
  async updateSpendingStats(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { amount, orderCount } = req.body;

      // 查找客户
      const customer = await AppDataSource.getRepository(Customer)
        .findOne({
          where: { id: Number(id), isDeleted: 0 }
        });

      if (!customer) {
        return errorResponse(res, 404, '客户不存在', null);
      }

      // 更新消费统计
      if (amount !== undefined) {
        customer.totalSpent += Number(amount);
      }
      
      if (orderCount !== undefined) {
        customer.orderCount += Number(orderCount);
      }

      // 根据消费金额自动更新客户等级
      if (customer.totalSpent >= 100000) {
        customer.level = CustomerLevel.VIP;
      } else if (customer.totalSpent >= 50000) {
        customer.level = CustomerLevel.PLATINUM;
      } else if (customer.totalSpent >= 20000) {
        customer.level = CustomerLevel.GOLD;
      } else if (customer.totalSpent >= 5000) {
        customer.level = CustomerLevel.SILVER;
      }

      // 保存客户更新
      const updatedCustomer = await AppDataSource.getRepository(Customer).save(customer);
      
      return successResponse(res, updatedCustomer, '更新客户消费统计成功');
    } catch (error) {
      logger.error('更新客户消费统计失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
}