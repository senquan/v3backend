import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Promotion, PromotionStatus, PromotionType } from '../models/promotion.model';
import { PromotionRule, PromotionRuleType } from '../models/promotion-rule.model';
import { Dict } from '../models/dict.model';
import { logger } from '../utils/logger';
import { errorResponse, successResponse } from '../utils/response';
import { LessThan, MoreThan } from 'typeorm';

interface FormulaConvertRequest {
  formula: string;
}

interface RuleResult {
  dslRule: string;
  conditions: string[];
  actions: string[];
  valid: boolean;
  message?: string;
}

export class PromotionController {
  // 创建促销活动
  async create(req: Request, res: Response): Promise<Response> {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { 
        name, 
        type, 
        startTime, 
        endTime, 
        description, 
        platformId,
        isStackable,
        copyFrom
      } = req.body;

      const userId = (req as any).user?.id;

      if (!name || !startTime || !endTime || !userId) {
        return errorResponse(res, 400, '缺少必要参数', null);
      }

      // 验证活动类型
      if (!Object.values(PromotionType).includes(type)) {
        return errorResponse(res, 400, '无效的活动类型', null);
      }

      // 验证时间
      const start = new Date(startTime);
      const end = new Date(endTime);
      if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
        return errorResponse(res, 400, '无效的活动时间范围', null);
      }

      let sourceRules: PromotionRule[] = [];
      if (copyFrom) {
        const sourcePromotion = await queryRunner.manager.findOne(Promotion, {
          where: { id: Number(copyFrom), isDeleted: 0 }
        });
        
        if (!sourcePromotion) {
          return errorResponse(res, 400, '要复制的活动不存在', null);
        }

        // 获取源活动的规则
        sourceRules = await queryRunner.manager.find(PromotionRule, {
          where: { promotionId: sourcePromotion.id, isDeleted: 0 }
        });
      }

      // 创建活动
      const promotion = new Promotion();
      promotion.name = name;
      promotion.type = type;
      promotion.startTime = start;
      promotion.endTime = end;
      promotion.description = description;
      promotion.platformId = platformId;
      promotion.userId = userId;
      promotion.status = PromotionStatus.DRAFT;
      promotion.isStackable = isStackable || false;

      // 保存活动
      const savedPromotion = await queryRunner.manager.save(promotion);

      // 如果有源规则，复制规则到新活动
      if (sourceRules.length > 0) {
        const newRules = sourceRules.map(sourceRule => {
          const newRule = new PromotionRule();
          newRule.name = sourceRule.name;
          newRule.type = sourceRule.type;
          newRule.condition = sourceRule.condition;
          newRule.discountValue = sourceRule.discountValue;
          newRule.promotionId = savedPromotion.id;
          return newRule;
        });

        // 保存复制的规则
        await queryRunner.manager.save(newRules);
        
        logger.info(`成功复制了 ${newRules.length} 条规则到新活动 ${savedPromotion.id}`);
      }

      await queryRunner.commitTransaction();
      return successResponse(res, savedPromotion, copyFrom ? '创建促销活动并复制规则成功' : '创建促销活动成功');

    } catch (error) {
      await queryRunner.rollbackTransaction();
      logger.error('创建促销活动失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    } finally {
      await queryRunner.release();
    }
  }

  // 获取促销活动列表
  async getList(req: Request, res: Response): Promise<Response> {
    try {
      const { 
        page = 1, 
        pageSize = 20, 
        status, 
        type = "",
        platformId,
        keyword,
        timeRange
      } = req.query;
      
      const queryBuilder = AppDataSource.getRepository(Promotion)
        .createQueryBuilder('promotion')
        .where('promotion.isDeleted = :isDeleted', { isDeleted: 0 });

      // 添加查询条件
      if (status !== undefined) {
        queryBuilder.andWhere('promotion.status = :status', { status });
      }
      
      if (type) {
        queryBuilder.andWhere('promotion.type = :type', { type });
      }
      
      if (platformId) {
        queryBuilder.andWhere('promotion.platformId = :platformId', { platformId });
      }
      
      if (keyword) {
        queryBuilder.andWhere('promotion.name LIKE :keyword', { keyword: `%${keyword}%` });
      }
      
      // 处理时间范围查询
      if (timeRange) {
        const now = new Date();
        
        if (timeRange === 'active') {
          // 正在进行中的活动
          queryBuilder.andWhere('promotion.startTime <= :now AND promotion.endTime > :now', { now });
        } else if (timeRange === 'upcoming') {
          // 即将开始的活动
          queryBuilder.andWhere('promotion.startTime > :now', { now });
        } else if (timeRange === 'ended') {
          // 已结束的活动
          queryBuilder.andWhere('promotion.endTime <= :now', { now });
        }
      }

      // 分页查询
      const [promotions, total] = await queryBuilder
        .orderBy('promotion.createdAt', 'DESC')
        .skip((Number(page) - 1) * Number(pageSize))
        .take(Number(pageSize))
        .getManyAndCount();

      const platformQueryBuilder = AppDataSource.getRepository(Dict)
      .createQueryBuilder('dict')
      .where('dict.group IN (:group)', { group: [1,3] });

      const dictData = await platformQueryBuilder.getMany();
      const platforms = dictData.filter(item => item.group === 1).map((item) => ({
        value: item.value,
        label: item.name
      }));
      const types = dictData.filter(item => item.group === 3).map((item) => ({
        value: item.value,
        label: item.name
      }));

      return successResponse(res, {
        promotions,
        platforms,
        types,
        total,
        page: Number(page),
        pageSize: Number(pageSize)
      }, '获取促销活动列表成功');

    } catch (error) {
      logger.error('获取促销活动列表失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 获取促销活动及其关联的规则
  async getListWithRules(req: Request, res: Response): Promise<Response> {
    try {
      const {
        platformId
      } = req.query;

      const promotionQueryBuilder = AppDataSource.getRepository(Promotion)
        .createQueryBuilder('promotion')
        .innerJoinAndSelect('promotion.rules', 'rules')
        .where('(promotion.platformId = :platformId OR promotion.platformId = 0)', { platformId })
        .andWhere('promotion.status != 0')
        .andWhere('promotion.isDeleted = 0')
        .andWhere('rules.isDeleted = 0')
        .andWhere('promotion.startTime <= NOW()')
        .andWhere('promotion.endTime >= NOW()');
      const promotionData = await promotionQueryBuilder.getMany();
      
      const types = await AppDataSource.getRepository(Dict)
        .createQueryBuilder('dict')
        .where('dict.group = :group', { group: 2 })
        .getMany();
        
      return successResponse(res, {
        promotions: promotionData,
        types
      }, '获取促销规则列表成功');
    } catch (error) {
      logger.error('获取促销活动及其关联的规则失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 获取促销活动详情
  async getDetail(req: Request, res: Response): Promise<Response> {

    const PROMOTION_RULE_TYPE_DICT_ID = 2;
    try {
      const { id } = req.params;
      
      const promotion = await AppDataSource.getRepository(Promotion)
        .createQueryBuilder('promotion')
        .leftJoinAndSelect('promotion.rules', 'rules', 'rules.isDeleted = 0')
        .where('promotion.id = :id', { id })
        .andWhere('promotion.isDeleted = :isDeleted', { isDeleted: 0 })
        .getOne();

      if (!promotion) {
        return errorResponse(res, 404, '促销活动不存在', null);
      }

      // 查询Dict表中的数据
      const typeQueryBuilder = AppDataSource.getRepository(Dict)
       .createQueryBuilder('dict')
       .where('dict.group = :group', { group: PROMOTION_RULE_TYPE_DICT_ID });

      const types = await typeQueryBuilder.getMany();

      return successResponse(res, {
        promotion,
        types
      }, '获取促销活动详情成功');
    } catch (error) {
      logger.error('获取促销活动详情失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 更新促销活动
  async update(req: Request, res: Response): Promise<Response> {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { id } = req.params;
      const { 
        name, 
        type, 
        startTime, 
        endTime, 
        status,
        description,
        platformId,
        isStackable
      } = req.body;

      // 查找活动
      const promotion = await queryRunner.manager.findOne(Promotion, {
        where: { id: Number(id), isDeleted: 0 }
      });

      if (!promotion) {
        return errorResponse(res, 404, '促销活动不存在', null);
      }

      // 更新活动基本信息
      if (name) promotion.name = name;
      if (type) promotion.type = type;
      if (description !== undefined) promotion.description = description;
      if (platformId !== undefined) promotion.platformId = platformId;
      if (isStackable !== undefined) promotion.isStackable = isStackable;
      
      // 更新时间
      let timeUpdated = false;
      if (startTime) {
        const start = new Date(startTime);
        if (!isNaN(start.getTime())) {
          promotion.startTime = start;
          timeUpdated = true;
        }
      }
      
      if (endTime) {
        const end = new Date(endTime);
        if (!isNaN(end.getTime())) {
          promotion.endTime = end;
          timeUpdated = true;
        }
      }
      
      // 如果时间更新了，重新计算状态
      if (timeUpdated && status != PromotionStatus.DRAFT) {
        const now = new Date();
        if (promotion.startTime <= now && promotion.endTime > now) {
          promotion.status = PromotionStatus.ACTIVE;
        } else if (promotion.startTime > now) {
          promotion.status = PromotionStatus.SCHEDULED;
        } else {
          promotion.status = PromotionStatus.ENDED;
        }
      } else {
        promotion.status = PromotionStatus.DRAFT;
      }

      // 保存活动更新
      await queryRunner.manager.save(promotion);

      await queryRunner.commitTransaction();
      return successResponse(res, promotion, '更新促销活动成功');

    } catch (error) {
      await queryRunner.rollbackTransaction();
      logger.error('更新促销活动失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    } finally {
      await queryRunner.release();
    }
  }

  // 删除促销活动（软删除）
  async delete(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      
      const result = await AppDataSource.getRepository(Promotion)
        .update({ id: Number(id), isDeleted: 0 }, { isDeleted: 1 });

      if (result.affected === 0) {
        return errorResponse(res, 404, '促销活动不存在', null);
      }

      return successResponse(res, null, '删除促销活动成功');
    } catch (error) {
      logger.error('删除促销活动失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 更新活动状态
  async updateStatus(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (status === undefined || !Object.values(PromotionStatus).includes(status)) {
        return errorResponse(res, 400, '无效的活动状态', null);
      }

      const result = await AppDataSource.getRepository(Promotion)
        .update({ id: Number(id), isDeleted: 0 }, { status });

      if (result.affected === 0) {
        return errorResponse(res, 404, '促销活动不存在', null);
      }

      // const now = new Date();
      // if (start <= now && end > now) {
      //   promotion.status = PromotionStatus.ACTIVE;
      // } else if (start > now) {
      //   promotion.status = PromotionStatus.SCHEDULED;
      // } else {
      //   promotion.status = PromotionStatus.ENDED;
      // }

      return successResponse(res, null, '更新活动状态成功');
    } catch (error) {
      logger.error('更新活动状态失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 自动更新活动状态（可以通过定时任务调用）
  async autoUpdateStatus(req: Request, res: Response): Promise<Response> {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const now = new Date();
      
      // 更新已开始的活动
      await queryRunner.manager.update(
        Promotion,
        { 
          startTime: LessThan(now), 
          endTime: MoreThan(now), 
          status: PromotionStatus.SCHEDULED,
          isDeleted: 0
        },
        { status: PromotionStatus.ACTIVE }
      );
      
      // 更新已结束的活动
      await queryRunner.manager.update(
        Promotion,
        { 
          endTime: LessThan(now), 
          status: PromotionStatus.ACTIVE,
          isDeleted: 0
        },
        { status: PromotionStatus.ENDED }
      );

      await queryRunner.commitTransaction();
      return successResponse(res, null, '自动更新活动状态成功');
    } catch (error) {
      await queryRunner.rollbackTransaction();
      logger.error('自动更新活动状态失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    } finally {
      await queryRunner.release();
    }
  }

  // 添加促销规则
  async addRule(req: Request, res: Response): Promise<Response> {
    try {
      const { name, type, promotionId, condition, discountValue } = req.body;

      // 验证必要字段
      if (!name || !type || !promotionId || condition === undefined || discountValue === undefined) {
        return errorResponse(res, 400, '缺少必要参数', null);
      }

      // 验证规则类型
      if (!Object.values(PromotionRuleType).includes(type)) {
        return errorResponse(res, 400, '无效的规则类型', null);
      }

      // condition 不能是 ""
      if (condition === '""') {
        return errorResponse(res, 400, 'condition 不能为空字符串', null);
      }

      // 验证促销活动是否存在
      const promotion = await AppDataSource.getRepository(Promotion).findOne({
        where: { id: Number(promotionId), isDeleted: 0 }
      });

      if (!promotion) {
        return errorResponse(res, 404, '促销活动不存在', null);
      }

      // 创建规则
      const rule = new PromotionRule();
      rule.name = name;
      rule.type = type;
      rule.condition = condition;
      rule.discountValue = discountValue;
      rule.promotionId = Number(promotionId);

      // 保存规则
      const savedRule = await AppDataSource.getRepository(PromotionRule).save(rule);

      return successResponse(res, savedRule, '添加促销规则成功');
    } catch (error) {
      logger.error('添加促销规则失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 获取促销规则列表
  async getRules(req: Request, res: Response): Promise<Response> {
    try {
      const { promotionId } = req.params;

      // 验证促销活动是否存在
      const promotion = await AppDataSource.getRepository(Promotion).findOne({
        where: { id: Number(promotionId), isDeleted: 0 }
      });

      if (!promotion) {
        return errorResponse(res, 404, '促销活动不存在', null);
      }

      // 获取规则列表
      const rules = await AppDataSource.getRepository(PromotionRule).find({
        where: { promotionId: Number(promotionId), isDeleted: 0 },
        order: { id: 'ASC' }
      });

      return successResponse(res, rules, '获取促销规则列表成功');
    } catch (error) {
      logger.error('获取促销规则列表失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 获取促销规则详情
  async getRule(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;

      // 查找规则
      const rule = await AppDataSource.getRepository(PromotionRule)
        .createQueryBuilder('rule')
        .leftJoinAndSelect('rule.promotion', 'promotion')
        .where('rule.id = :ruleId', { ruleId: Number(id) })
        .andWhere('rule.isDeleted = :isDeleted', { isDeleted: 0 })
        .getOne();

      if (!rule) {
        return errorResponse(res, 404, '促销规则不存在', null);
      }

      return successResponse(res, rule, '获取促销规则详情成功');
    } catch (error) {
      logger.error('获取促销规则详情失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 更新促销规则
  async updateRule(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { name, type, condition, discountValue } = req.body;

      // 查找规则
      const rule = await AppDataSource.getRepository(PromotionRule).findOne({
        where: { id: Number(id), isDeleted: 0 }
      });

      if (!rule) {
        return errorResponse(res, 404, '促销规则不存在', null);
      }

      // 更新规则信息
      if (name) rule.name = name;
      if (type) rule.type = type;
      if (condition !== undefined) rule.condition = condition;
      if (discountValue !== undefined) rule.discountValue = discountValue;

      // 保存更新
      const updatedRule = await AppDataSource.getRepository(PromotionRule).save(rule);

      return successResponse(res, updatedRule, '更新促销规则成功');
    } catch (error) {
      logger.error('更新促销规则失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 删除促销规则
  async deleteRule(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;

      // 软删除规则
      const result = await AppDataSource.getRepository(PromotionRule)
        .update({ id: Number(id), isDeleted: 0 }, { isDeleted: 1 });

      if (result.affected === 0) {
        return errorResponse(res, 404, '促销规则不存在', null);
      }

      return successResponse(res, null, '删除促销规则成功');
    } catch (error) {
      logger.error('删除促销规则失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  async convertRule(req: Request, res: Response): Promise<Response> {

    const { id } = req.params;
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      console.log('convertRule', req.body);
      // const rules = req.body as Array<{
      //   name: string;
      //   condition: {
      //     [key: string]: {
      //       [operator: string]: string[] | number;
      //     };
      //   };
      //   discountRate: number;
      //   applyTo: string;
      // }>;

      // if (!Array.isArray(rules) || rules.length === 0) {
      //   return errorResponse(res, 400, '请提供有效的规则数组', null);
      // }

      interface DiscountRule {
        name: string;           // 规则名称
        condition: {            // 匹配条件
          [field: string]: {    // 字段条件
            [operator: string]: string[] | number;  // 操作符和值
          }
        };
        discountValue: number;  // 折扣值（正数为折扣，负数为加价）
      }
      
      const discountRules: DiscountRule[] = [
        {
          name: "G12Z系列基础折扣",
          condition: {
            modelType: { in: ["G12Z100", "G12Z100A"] }
          },
          discountValue: 0.03
        },
        {
          name: "G12Z系列无颜色加价",
          condition: {
            modelType: { in: ["G12Z100", "G12Z100A"] },
            color: { equal: [""] }
          },
          discountValue: -0.04
        },
        {
          name: "G57Z系列折扣",
          condition: {
            modelType: { in: ["G57Z100", "G57Z100A"] }
          },
          discountValue: -0.05
        },
        {
          name: "G52Z系列基础折扣",
          condition: {
            modelType: { in: ["G52Z100", "G52Z100A"] }
          },
          discountValue: -0.03
        },
        {
          name: "G52Z系列无颜色加价",
          condition: {
            modelType: { in: ["G52Z100", "G52Z100A"] },
            color: { equal: [""] }
          },
          discountValue: -0.04
        },
        {
          name: "G60Z系列折扣",
          condition: {
            modelType: { in: ["G60Z100", "G60Z100A"] }
          },
          discountValue: -0.03
        },
        {
          name: "LED筒灯系列折扣",
          condition: {
            series: { in: ["公牛LED筒灯", "T02筒灯", "T02P筒灯"] }
          },
          discountValue: -0.05
        },
        {
          name: "吸顶灯折扣",
          condition: {
            series: { in: ["公牛吸顶灯"] }
          },
          discountValue: -0.15
        },
        {
          name: "特定名称灯具折扣",
          condition: {
            name: { contains: [
              "*明润*", "*明皓*", "*灿轩*", "*灿彩*", 
              "*朗晨*", "*X46*", "*X62*", "*X22*", 
              "*X38*", "*星灿*", "*星悦*", "*纯皓*"
            ]}
          },
          discountValue: 0.10
        }
      ];

      // 批量创建规则
      const promotionRules = discountRules.map(rule => {
        const promotionRule = new PromotionRule();
        promotionRule.name = rule.name;
        promotionRule.condition = JSON.stringify(rule.condition);
        promotionRule.discountValue = rule.discountValue;
        promotionRule.type = PromotionRuleType.DIRECT_DISCOUNT;
        promotionRule.promotionId = Number(id);
        return promotionRule;
      });

      // 批量保存规则
      await queryRunner.manager.save(promotionRules);
      
      await queryRunner.commitTransaction();
      return successResponse(res, promotionRules, '规则批量导入成功');
    } catch (error) {
      await queryRunner.rollbackTransaction();
      logger.error('批量导入规则失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    } finally {
      await queryRunner.release();
    }
  }
}