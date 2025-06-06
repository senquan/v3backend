import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Coupon, CouponStatus, CouponType } from '../models/coupon.model';
import { CouponUser, CouponUserStatus } from '../models/coupon-user.model';
import { User } from '../models/user.model';
import { Dict } from '../models/dict.model';
import { logger } from '../utils/logger';
import { errorResponse, successResponse } from '../utils/response';
import { LessThan, MoreThan, Between, Not } from 'typeorm';
import { generateRandomCode } from '../utils';

export class CouponController {
  // 创建优惠券
  async create(req: Request, res: Response): Promise<Response> {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { 
        name, 
        type, 
        code,
        platformId,
        amount,
        discount,
        minAmount,
        startTime, 
        endTime,
        totalCount,
        perLimit,
        useRules,
        description,
        status = CouponStatus.DRAFT,
        creatorId
      } = req.body;

      // 验证必要字段
      if (!name || !type || !startTime || !endTime) {
        return errorResponse(res, 400, '缺少必要参数', null);
      }

      // 验证优惠券类型
      if (!Object.values(CouponType).includes(type)) {
        return errorResponse(res, 400, '无效的优惠券类型', null);
      }

      // 验证时间
      const start = new Date(startTime);
      const end = new Date(endTime);
      if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
        return errorResponse(res, 400, '无效的有效期时间范围', null);
      }

      // 根据类型验证必要参数
      if (type === CouponType.CASH && !amount) {
        return errorResponse(res, 400, '现金券必须设置优惠金额', null);
      }

      if (type === CouponType.DISCOUNT && !discount) {
        return errorResponse(res, 400, '折扣券必须设置折扣率', null);
      }

      // 创建优惠券
      const coupon = new Coupon();
      coupon.name = name;
      coupon.type = type;
      coupon.code = code || null;
      coupon.platformId = Number(platformId) || 0;
      coupon.amount = amount || null;
      coupon.discount = discount || null;
      coupon.minAmount = minAmount || null;
      coupon.startTime = start;
      coupon.endTime = end;
      coupon.totalCount = totalCount || 0;
      coupon.perLimit = perLimit || 1;
      coupon.useRules = useRules || null;
      coupon.description = description || null;
      coupon.status = status;
      coupon.creatorId = creatorId || null;

      // 保存优惠券
      const savedCoupon = await queryRunner.manager.save(coupon);
      
      await queryRunner.commitTransaction();
      return successResponse(res, savedCoupon, '创建优惠券成功');

    } catch (error) {
      await queryRunner.rollbackTransaction();
      logger.error('创建优惠券失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    } finally {
      await queryRunner.release();
    }
  }

  // 获取优惠券列表
  async getList(req: Request, res: Response): Promise<Response> {
    try {
      const { 
        page = 1, 
        pageSize = 20, 
        status, 
        type,
        platformId,
        keyword,
        timeRange
      } = req.query;
      
      const queryBuilder = AppDataSource.getRepository(Coupon)
        .createQueryBuilder('coupon')
        .where('coupon.isDeleted = :isDeleted', { isDeleted: 0 });

      // 添加查询条件
      if (status !== undefined) {
        queryBuilder.andWhere('coupon.status = :status', { status });
      }

      if (Number(platformId) > 0) {
        queryBuilder.andWhere('coupon.platformId = :platformId', { platformId });
      }
      
      if (type) {
        queryBuilder.andWhere('coupon.type = :type', { type });
      }
      
      if (keyword) {
        queryBuilder.andWhere('coupon.name LIKE :keyword OR coupon.code LIKE :keyword', 
          { keyword: `%${keyword}%` });
      }
      
      // 处理时间范围查询
      if (timeRange) {
        const now = new Date();
        
        if (timeRange === 'active') {
          // 正在生效的优惠券
          queryBuilder.andWhere('coupon.startTime <= :now AND coupon.endTime > :now', { now });
        } else if (timeRange === 'upcoming') {
          // 即将开始的优惠券
          queryBuilder.andWhere('coupon.startTime > :now', { now });
        } else if (timeRange === 'expired') {
          // 已过期的优惠券
          queryBuilder.andWhere('coupon.endTime <= :now', { now });
        }
      }

      // 分页查询
      const [coupons, total] = await queryBuilder
        .orderBy('coupon.created_at', 'DESC')
        .skip((Number(page) - 1) * Number(pageSize))
        .take(Number(pageSize))
        .getManyAndCount();

      const platformQueryBuilder = AppDataSource.getRepository(Dict)
        .createQueryBuilder('dict')
        .where('dict.group = :group', { group: 1 });
  
        const dictData = await platformQueryBuilder.getMany();
        const platforms = dictData.map((item) => ({
          value: item.value,
          label: item.name
        }));

      return successResponse(res, {
        coupons,
        platforms,
        total,
        page: Number(page),
        pageSize: Number(pageSize)
      }, '获取优惠券列表成功');

    } catch (error) {
      logger.error('获取优惠券列表失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 获取优惠券详情
  async getDetail(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      
      const coupon = await AppDataSource.getRepository(Coupon)
        .findOne({
          where: { id: Number(id), isDeleted: 0 },
          relations: ['creator']
        });

      if (!coupon) {
        return errorResponse(res, 404, '优惠券不存在', null);
      }

      return successResponse(res, coupon, '获取优惠券详情成功');
    } catch (error) {
      logger.error('获取优惠券详情失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 更新优惠券
  async update(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { 
        name, 
        type, 
        code,
        platformId,
        amount,
        discount,
        minAmount,
        startTime, 
        endTime,
        totalCount,
        perLimit,
        useRules,
        description,
        status
      } = req.body;

      // 查找优惠券
      const coupon = await AppDataSource.getRepository(Coupon)
        .findOne({
          where: { id: Number(id), isDeleted: 0 }
        });

      if (!coupon) {
        return errorResponse(res, 404, '优惠券不存在', null);
      }

      // 更新优惠券基本信息
      if (name) coupon.name = name;
      if (type) coupon.type = type;
      if (code !== undefined) coupon.code = code;
      if (platformId !== undefined) coupon.platformId = platformId;
      if (amount !== undefined) coupon.amount = amount;
      if (discount !== undefined) coupon.discount = discount;
      if (minAmount !== undefined) coupon.minAmount = minAmount;
      if (totalCount !== undefined) coupon.totalCount = totalCount;
      if (perLimit !== undefined) coupon.perLimit = perLimit;
      if (useRules!== undefined) coupon.useRules = useRules;
      if (description !== undefined) coupon.description = description;
      if (status !== undefined) coupon.status = status;
      
      // 更新时间
      if (startTime) {
        const start = new Date(startTime);
        if (!isNaN(start.getTime())) {
          coupon.startTime = start;
        }
      }
      
      if (endTime) {
        const end = new Date(endTime);
        if (!isNaN(end.getTime())) {
          coupon.endTime = end;
        }
      }

      // 保存优惠券更新
      const updatedCoupon = await AppDataSource.getRepository(Coupon).save(coupon);
      
      return successResponse(res, updatedCoupon, '更新优惠券成功');

    } catch (error) {
      logger.error('更新优惠券失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 删除优惠券（软删除）
  async delete(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      
      const result = await AppDataSource.getRepository(Coupon)
        .update({ id: Number(id), isDeleted: 0 }, { isDeleted: 1 });

      if (result.affected === 0) {
        return errorResponse(res, 404, '优惠券不存在', null);
      }

      return successResponse(res, null, '删除优惠券成功');
    } catch (error) {
      logger.error('删除优惠券失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 用户领取优惠券
  async receiveCoupon(req: Request, res: Response): Promise<Response> {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { couponId, userId } = req.body;

      // 验证必要字段
      if (!couponId || !userId) {
        return errorResponse(res, 400, '缺少必要参数', null);
      }

      // 查找优惠券
      const coupon = await queryRunner.manager.findOne(Coupon, {
        where: { 
          id: couponId, 
          isDeleted: 0,
          status: CouponStatus.ACTIVE
        }
      });

      if (!coupon) {
        return errorResponse(res, 404, '优惠券不存在或未激活', null);
      }

      // 验证优惠券是否在有效期内
      const now = new Date();
      if (now < coupon.startTime || now > coupon.endTime) {
        return errorResponse(res, 400, '优惠券不在有效期内', null);
      }

      // 验证优惠券是否已达到发放上限
      if (coupon.totalCount > 0 && coupon.receivedCount >= coupon.totalCount) {
        return errorResponse(res, 400, '优惠券已领完', null);
      }

      // 验证用户是否存在
      const user = await queryRunner.manager.findOne(User, {
        where: { id: userId }
      });

      if (!user) {
        return errorResponse(res, 404, '用户不存在', null);
      }

      // 验证用户领取数量是否超过限制
      if (coupon.perLimit > 0) {
        const receivedCount = await queryRunner.manager.count(CouponUser, {
          where: { 
            couponId: couponId,
            userId: userId
          }
        });

        if (receivedCount >= coupon.perLimit) {
          return errorResponse(res, 400, '已超过每人领取限制', null);
        }
      }

      // 创建优惠券用户关联
      const couponUser = new CouponUser();
      couponUser.couponId = couponId;
      couponUser.userId = userId;
      couponUser.status = CouponUserStatus.UNUSED;
      
      // 如果优惠券有code，生成唯一的优惠券码
      if (coupon.code) {
        couponUser.code = `${coupon.code}-${generateRandomCode(8)}`;
      }

      // 保存优惠券用户关联
      await queryRunner.manager.save(couponUser);

      // 更新优惠券领取数量
      coupon.receivedCount += 1;
      await queryRunner.manager.save(coupon);

      await queryRunner.commitTransaction();
      return successResponse(res, couponUser, '领取优惠券成功');

    } catch (error) {
      await queryRunner.rollbackTransaction();
      logger.error('领取优惠券失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    } finally {
      await queryRunner.release();
    }
  }

  // 获取用户优惠券列表
  async getUserCoupons(req: Request, res: Response): Promise<Response> {
    try {
      const { userId, status, page = 1, pageSize = 20 } = req.query;

      if (!userId) {
        return errorResponse(res, 400, '缺少用户ID', null);
      }

      const queryBuilder = AppDataSource.getRepository(CouponUser)
        .createQueryBuilder('couponUser')
        .leftJoinAndSelect('couponUser.coupon', 'coupon')
        .where('couponUser.userId = :userId', { userId });

      if (status !== undefined) {
        queryBuilder.andWhere('couponUser.status = :status', { status });
      }

      // 分页查询
      const [couponUsers, total] = await queryBuilder
        .orderBy('couponUser.created_at', 'DESC')
        .skip((Number(page) - 1) * Number(pageSize))
        .take(Number(pageSize))
        .getManyAndCount();

      return successResponse(res, {
        coupons: couponUsers,
        total,
        page: Number(page),
        pageSize: Number(pageSize)
      }, '获取用户优惠券列表成功');

    } catch (error) {
      logger.error('获取用户优惠券列表失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 使用优惠券
  async useCoupon(req: Request, res: Response): Promise<Response> {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { couponUserId, orderId } = req.body;

      // 验证必要字段
      if (!couponUserId || !orderId) {
        return errorResponse(res, 400, '缺少必要参数', null);
      }

      // 查找用户优惠券
      const couponUser = await queryRunner.manager.findOne(CouponUser, {
        where: { 
          id: couponUserId,
          status: CouponUserStatus.UNUSED
        },
        relations: ['coupon']
      });

      if (!couponUser) {
        return errorResponse(res, 404, '优惠券不存在或已使用', null);
      }

      // 验证优惠券是否在有效期内
      const now = new Date();
      if (now < couponUser.coupon.startTime || now > couponUser.coupon.endTime) {
        return errorResponse(res, 400, '优惠券已过期', null);
      }

      // 更新优惠券使用状态
      couponUser.status = CouponUserStatus.USED;
      couponUser.orderId = orderId;
      couponUser.usedAt = now;
      await queryRunner.manager.save(couponUser);

      // 更新优惠券使用数量
      couponUser.coupon.usedCount += 1;
      await queryRunner.manager.save(couponUser.coupon);

      await queryRunner.commitTransaction();
      return successResponse(res, couponUser, '使用优惠券成功');

    } catch (error) {
      await queryRunner.rollbackTransaction();
      logger.error('使用优惠券失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    } finally {
      await queryRunner.release();
    }
  }

  // 自动更新优惠券状态（可以通过定时任务调用）
  async autoUpdateStatus(req: Request, res: Response): Promise<Response> {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const now = new Date();
      
      // 更新已过期的优惠券
      await queryRunner.manager.update(
        Coupon,
        { 
          endTime: LessThan(now), 
          status: Not(CouponStatus.EXPIRED),
          isDeleted: 0
        },
        { status: CouponStatus.EXPIRED }
      );
      
      // 更新用户优惠券状态 - 修复 subQuery 方法不存在的问题
      // 先查询已过期的优惠券ID
      const expiredCouponIds = await queryRunner.manager
        .createQueryBuilder()
        .select('coupon.id')
        .from(Coupon, 'coupon')
        .where('coupon.endTime < :now', { now })
        .getMany();
      
      // 如果有过期的优惠券，更新相关的用户优惠券状态
      if (expiredCouponIds.length > 0) {
        const ids = expiredCouponIds.map(coupon => coupon.id);
        await queryRunner.manager
          .createQueryBuilder()
          .update(CouponUser)
          .set({ status: CouponUserStatus.EXPIRED })
          .where('status = :status', { status: CouponUserStatus.UNUSED })
          .andWhere('couponId IN (:...ids)', { ids })
          .execute();
      }

      await queryRunner.commitTransaction();
      return successResponse(res, null, '自动更新优惠券状态成功');
    } catch (error) {
      await queryRunner.rollbackTransaction();
      logger.error('自动更新优惠券状态失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    } finally {
      await queryRunner.release();
    }
  }
}