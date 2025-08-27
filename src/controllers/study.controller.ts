import { Request, Response } from "express";
import { In } from "typeorm";
import { AppDataSource } from "../config/database";
import { StudyPlan } from "../models/entities/StudyPlan.entity";
import { StudyCourseware } from "../models/entities/StudyCourseware.entity";
import { MockExam } from "../models/entities/MockExam.entity";
import { StudyExamRecord } from "../models/entities/StudyExamRecord.entity";
import { User } from "../models/entities/User.entity";
import { logger } from "../utils/logger";
import { errorResponse, successResponse } from "../utils/response";

export class StudyPlanController {
  // 获取自学计划列表
  async getList(req: Request, res: Response): Promise<Response> {
    try {
      const { page = 1, pageSize = 20, keyword, category, level, status } = req.query;
      const userId = (req as any).user?.id;

      if (!userId) {
        return errorResponse(res, 401, "用户未登录");
      }

      // 构建查询条件
      const queryBuilder = AppDataSource.getRepository(StudyPlan)
        .createQueryBuilder("plan")
        .leftJoinAndSelect("plan.creatorEntity", "creator")
        .leftJoinAndSelect("plan.coursewares", "coursewares")
        .where("plan.is_deleted = :is_deleted", { is_deleted: 0 })
        .andWhere("plan.creator = :userId", { userId });

      // 添加筛选条件
      if (keyword) {
        queryBuilder.andWhere("plan.title LIKE :keyword", { keyword: `%${keyword}%` });
      }

      if (category) {
        queryBuilder.andWhere("plan.category = :category", { category: Number(category) });
      }

      if (level) {
        queryBuilder.andWhere("plan.level = :level", { level: Number(level) });
      }

      if (status !== undefined) {
        queryBuilder.andWhere("plan.status = :status", { status: Number(status) });
      }

      // 计算分页
      const pageNum = Number(page);
      const pageSizeNum = Number(pageSize);
      const skip = (pageNum - 1) * pageSizeNum;

      // 排序
      queryBuilder.orderBy("plan.create_time", "DESC");

      // 执行查询
      const [plans, total] = await queryBuilder
        .skip(skip)
        .take(pageSizeNum)
        .getManyAndCount();

      return successResponse(res, {
        plans,
        total,
        page: pageNum,
        pageSize: pageSizeNum,
        totalPages: Math.ceil(total / pageSizeNum)
      }, "获取自学计划列表成功");
    } catch (error) {
      logger.error("获取自学计划列表失败:", error);
      return errorResponse(res, 500, "获取自学计划列表失败");
    }
  }

  // 获取自学计划详情
  async getDetail(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        return errorResponse(res, 401, "用户未登录");
      }

      const plan = await AppDataSource.getRepository(StudyPlan)
        .createQueryBuilder("plan")
        .leftJoinAndSelect("plan.creatorEntity", "creator")
        .leftJoinAndSelect("plan.coursewares", "coursewares")
        // .leftJoinAndSelect("plan.mockExams", "mockExams")
        // .leftJoinAndSelect("plan.examRecords", "examRecords")
        .where("plan.id = :id", { id })
        .andWhere("plan.is_deleted = :is_deleted", { is_deleted: 0 })
        .andWhere("plan.creator = :userId", { userId })
        .getOne();

      if (!plan) {
        return errorResponse(res, 404, "自学计划不存在");
      }

      return successResponse(res, plan, "获取自学计划详情成功");
    } catch (error) {
      logger.error("获取自学计划详情失败:", error);
      return errorResponse(res, 500, "获取自学计划详情失败");
    }
  }

  // 创建自学计划
  async create(req: Request, res: Response): Promise<Response> {
    
    const queryRunner = AppDataSource.createQueryRunner();
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return errorResponse(res, 401, "用户未登录");
      }

      const {
        title,
        description,
        category,
        level,
        study_hours,
        target_score,
        coursewares
      } = req.body;

      // 验证必填字段
      if (!title || !category || !level) {
        return errorResponse(res, 500, "标题、分类和难度级别为必填项");
      }

      if (!coursewares || coursewares.length === 0) {
        return errorResponse(res, 500, "请选择课件");
      }

      // 开始事务
      await queryRunner.connect();
      await queryRunner.startTransaction();

      const studyPlanRepo = queryRunner.manager.getRepository(StudyPlan);
      
      const newPlan = studyPlanRepo.create({
        title,
        description,
        category: Number(category),
        level: Number(level),
        study_hours: study_hours ? Number(study_hours) : 0,
        target_score: target_score ? Number(target_score) : 60,
        status: 0, // 未开始
        progress: 0,
        creator: userId
      });

      const savedPlan = await studyPlanRepo.save(newPlan);

      // 插入培训记录与课件关联
      if (coursewares && coursewares.length > 0) {
          const coursewareEntities = coursewares.map((coursewareId: number) => {
              const studyPlanCourseware = new StudyCourseware();
              studyPlanCourseware.study_plan_id = savedPlan.id;
              studyPlanCourseware.courseware_id = coursewareId;
              studyPlanCourseware.creator = userId;
              studyPlanCourseware.create_time = new Date();
              studyPlanCourseware.update_time = new Date();
              return studyPlanCourseware;
          });
          await queryRunner.manager.save(coursewareEntities);
      }

      await queryRunner.commitTransaction();
      return successResponse(res, savedPlan, "创建自学计划成功");
    } catch (error) {
      logger.error("创建自学计划失败:", error);
      await queryRunner.rollbackTransaction();
      return errorResponse(res, 500, "创建自学计划失败");
    } finally {
      await queryRunner.release();
    }
  }

  // 更新自学计划
  async update(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        return errorResponse(res, 401, "用户未登录");
      }

      const studyPlanRepo = AppDataSource.getRepository(StudyPlan);
      
      const existingPlan = await studyPlanRepo.findOne({
        where: { id: Number(id), creator: userId, is_deleted: 0 }
      });

      if (!existingPlan) {
        return errorResponse(res, 404, "自学计划不存在");
      }

      const {
        title,
        description,
        category,
        level,
        study_hours,
        target_score,
        status,
        progress,
        objectives,
        requirements,
        start_time,
        end_time
      } = req.body;

      // 更新字段
      if (title !== undefined) existingPlan.title = title;
      if (description !== undefined) existingPlan.description = description;
      if (category !== undefined) existingPlan.category = Number(category);
      if (level !== undefined) existingPlan.level = Number(level);
      if (study_hours !== undefined) existingPlan.study_hours = Number(study_hours);
      if (target_score !== undefined) existingPlan.target_score = Number(target_score);
      if (status !== undefined) existingPlan.status = Number(status);
      if (progress !== undefined) existingPlan.progress = Number(progress);
      if (objectives !== undefined) existingPlan.objectives = objectives;
      if (requirements !== undefined) existingPlan.requirements = requirements;
      if (start_time !== undefined) existingPlan.start_time = start_time ? new Date(start_time) : null;
      if (end_time !== undefined) existingPlan.end_time = end_time ? new Date(end_time) : null;
      
      existingPlan.updater = userId;

      // 如果状态变为已完成，设置完成时间
      if (status === 2 && existingPlan.status !== 2) {
        existingPlan.completed_time = new Date();
      }

      const updatedPlan = await studyPlanRepo.save(existingPlan);

      return successResponse(res, updatedPlan, "更新自学计划成功");
    } catch (error) {
      logger.error("更新自学计划失败:", error);
      return errorResponse(res, 500, "更新自学计划失败");
    }
  }

  // 删除自学计划
  async delete(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        return errorResponse(res, 401, "用户未登录");
      }

      const studyPlanRepo = AppDataSource.getRepository(StudyPlan);
      
      const existingPlan = await studyPlanRepo.findOne({
        where: { id: Number(id), creator: userId, is_deleted: 0 }
      });

      if (!existingPlan) {
        return errorResponse(res, 404, "自学计划不存在");
      }

      // 软删除
      existingPlan.is_deleted = 1;
      existingPlan.updater = userId;
      
      await studyPlanRepo.save(existingPlan);

      return successResponse(res, "删除自学计划成功");
    } catch (error) {
      logger.error("删除自学计划失败:", error);
      return errorResponse(res, 500, "删除自学计划失败");
    }
  }

  // 批量删除自学计划
  async batchDelete(req: Request, res: Response): Promise<Response> {
    try {
      const { ids } = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        return errorResponse(res, 401, "用户未登录");
      }

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return errorResponse(res, 400, "请选择要删除的自学计划");
      }

      const studyPlanRepo = AppDataSource.getRepository(StudyPlan);
      
      await studyPlanRepo.update(
        { id: In(ids), creator: userId, is_deleted: 0 },
        { is_deleted: 1, updater: userId }
      );

      return successResponse(res, "批量删除自学计划成功");
    } catch (error) {
      logger.error("批量删除自学计划失败:", error);
      return errorResponse(res, 500, "批量删除自学计划失败");
    }
  }

  // 开始学习计划
  async startPlan(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        return errorResponse(res, 401, "用户未登录");
      }

      const studyPlanRepo = AppDataSource.getRepository(StudyPlan);
      
      const existingPlan = await studyPlanRepo.findOne({
        where: { id: Number(id), creator: userId, is_deleted: 0 }
      });

      if (!existingPlan) {
        return errorResponse(res, 404, "自学计划不存在");
      }

      if (existingPlan.status !== 0) {
        return errorResponse(res, 400, "该学习计划已开始或已完成");
      }

      // 更新状态为进行中
      existingPlan.status = 1;
      existingPlan.start_time = new Date();
      existingPlan.updater = userId;
      
      await studyPlanRepo.save(existingPlan);

      return successResponse(res, "开始学习计划成功");
    } catch (error) {
      logger.error("开始学习计划失败:", error);
      return errorResponse(res, 500, "开始学习计划失败");
    }
  }

  // 完成学习计划
  async completePlan(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        return errorResponse(res, 401, "用户未登录");
      }

      const studyPlanRepo = AppDataSource.getRepository(StudyPlan);
      
      const existingPlan = await studyPlanRepo.findOne({
        where: { id: Number(id), creator: userId, is_deleted: 0 }
      });

      if (!existingPlan) {
        return errorResponse(res, 404, "自学计划不存在");
      }

      if (existingPlan.status === 2) {
        return errorResponse(res, 400, "该学习计划已完成");
      }

      // 更新状态为已完成
      existingPlan.status = 2;
      existingPlan.progress = 100;
      existingPlan.completed_time = new Date();
      existingPlan.updater = userId;
      
      await studyPlanRepo.save(existingPlan);

      return successResponse(res, "完成学习计划成功");
    } catch (error) {
      logger.error("完成学习计划失败:", error);
      return errorResponse(res, 500, "完成学习计划失败");
    }
  }

  // 更新学习进度
  async updateProgress(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { progress } = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        return errorResponse(res, 401, "用户未登录");
      }

      if (progress === undefined || progress < 0 || progress > 100) {
        return errorResponse(res, 400, "进度值必须在0-100之间");
      }

      const studyPlanRepo = AppDataSource.getRepository(StudyPlan);
      
      const existingPlan = await studyPlanRepo.findOne({
        where: { id: Number(id), creator: userId, is_deleted: 0 }
      });

      if (!existingPlan) {
        return errorResponse(res, 404, "自学计划不存在");
      }

      // 更新进度
      existingPlan.progress = Number(progress);
      existingPlan.updater = userId;
      
      // 如果进度达到100%，自动完成计划
      if (progress >= 100 && existingPlan.status !== 2) {
        existingPlan.status = 2;
        existingPlan.completed_time = new Date();
      }
      
      await studyPlanRepo.save(existingPlan);

      return successResponse(res, "更新学习进度成功");
    } catch (error) {
      logger.error("更新学习进度失败:", error);
      return errorResponse(res, 500, "更新学习进度失败");
    }
  }
}