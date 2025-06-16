import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { TrainingPlan } from '../models/entities/TrainingPlan.entity';
import { TrainingPlanScope } from '../models/entities/TrainingPlanScope.entity';
import { logger } from '../utils/logger';
import { errorResponse, successResponse } from '../utils/response';
import { Project } from '../models/entities/Project.entity';
import { Branch } from '../models/entities/Branch.entity';

export class TrainingPlanController {
  // 获取培训计划列表
  async getList(req: Request, res: Response): Promise<Response> {
    try {
      const { page = 1, pageSize = 20, keyword, mode, category, method, sort } = req.query;
      
      const isGroupUser = true; // 局集团用户

      // 构建查询条件
      const queryBuilder = AppDataSource.getRepository(TrainingPlan)
        .createQueryBuilder('plan')
        .leftJoinAndSelect('plan.scopes', 'scope')
        .leftJoinAndSelect('scope.branch','branch')
        .leftJoinAndSelect('scope.project','project')
        .where('plan.is_deleted = :is_deleted', { is_deleted: 0 });
      
      // 添加筛选条件
      if (keyword) {
        queryBuilder.andWhere('plan.name LIKE :keyword', { keyword: `%${keyword}%` });
      }

      // 培训类别
      if (category) {
        queryBuilder.andWhere('plan.training_category = :category', { category: Number(category) });
      }

      if (method) {
        queryBuilder.andWhere('plan.assessment_method = :method', { method: Number(method) });
      }

      if (mode) {
        queryBuilder.andWhere('plan.training_mode = :mode', { mode: Number(mode) });
      }

      // 计算分页
      const pageNum = Number(page);
      const pageSizeNum = Number(pageSize);
      const skip = (pageNum - 1) * pageSizeNum;
      
      // 添加排序
      if (sort) {
        const order = sort.toString().substring(0, 1) === "-" ? "DESC" : "ASC";
        let field = sort.toString().substring(1);
        if (field === "id") field = "_id"
        queryBuilder.orderBy(`plan.${field}`, order);
      } else {
        queryBuilder.orderBy('plan._id', 'DESC');
      }

      // 获取总数和分页数据
      const [plans, total] = await queryBuilder
        .skip(skip)
        .take(pageSizeNum)
        .getManyAndCount();
      
      // 处理培训范围数据
      const formattedPlans = plans.map(plan => {
        const training_scope = plan.scopes.map(scope => {
          if (scope.ref_type === 1) {
            return `branch_${scope.branch_id}`;
          } else {
            return `dept_${scope.project_department_id}`;
          }
        });

        const training_scope_names = plan.scopes.map(scope => {
          if (scope.ref_type === 1) {
            return scope.branch?.name;
          } else {
            return scope.project?.name;
          }
        });
        
        return {
          id: plan._id,
          name: plan.name,
          training_scope,
          training_scope_names,
          trainer: plan.trainer,
          training_mode: plan.training_mode,
          training_category: plan.training_category,
          planned_participants: plan.planned_participants,
          planned_time: plan.planned_time,
          training_hours: plan.training_hours,
          assessment_method: plan.assessment_method,
          exam_method: plan.exam_method,
          status: plan.status,
          created_time: plan.created_time,
          updated_time: plan.updated_time
        };
      });

      const scopes = [] as any[];
      const projects = await AppDataSource.getRepository(Project)
        .createQueryBuilder('project')
        .getMany();

      if (isGroupUser) {
        const branchs = await AppDataSource.getRepository(Branch)
          .createQueryBuilder('branch')
          .getMany();

        for (const branch of branchs) {
          scopes.push({
            label: branch.name,
            value: `branch_${branch._id}`,
            children: projects.filter(project => {
              return project.branch === branch._id;
            }).map(project => {
              return {
                label: project.name,
                value: `dept_${project._id}`
              }
            })
          })
        }
      } else {
        scopes.push(projects.map(project => {
          return {
            label: project.name,
            value: `dept_${project._id}`
          }
        }))
      }
      
      return successResponse(res, {
        plans: formattedPlans,
        scopes,
        total,
        page: pageNum,
        pageSize: pageSizeNum
      }, '获取培训计划列表成功');
    } catch (error) {
      logger.error('获取培训计划列表失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
  
  // 获取所有培训计划（用于下拉选择）
  async getAllCategories(req: Request, res: Response): Promise<Response> {
    try {
      const categories = await AppDataSource.getRepository(TrainingPlan)
        .createQueryBuilder('plan')
        .orderBy('plan.id', 'ASC')
        .getMany();
      
      return successResponse(res, categories, '获取所有培训计划成功');
    } catch (error) {
      logger.error('获取所有培训计划失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
  
  // 获取培训计划详情
  async getDetail(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      
      const plan = await AppDataSource.getRepository(TrainingPlan)
        .createQueryBuilder('plan')
        .leftJoinAndSelect('plan.scopes', 'scope')
        .where('plan._id = :id', { id: Number(id) })
        .andWhere('plan.is_deleted = :is_deleted', { is_deleted: 0 })
        .getOne();
      
      if (!plan) {
        return errorResponse(res, 404, '培训计划不存在', null);
      }
      
      // 处理培训范围数据
      const training_scope = plan.scopes.map(scope => {
        if (scope.ref_type === 1) { // BRANCH
          return `branch_${scope.branch_id}`;
        } else { // PROJECT_DEPARTMENT
          return `dept_${scope.project_department_id}`;
        }
      });
      
      const formattedPlan = {
        id: plan._id,
        name: plan.name,
        training_scope,
        trainer: plan.trainer,
        training_mode: plan.training_mode,
        training_category: plan.training_category,
        planned_participants: plan.planned_participants,
        planned_time: plan.planned_time,
        training_hours: plan.training_hours,
        assessment_method: plan.assessment_method,
        exam_method: plan.exam_method,
        status: plan.status,
        created_time: plan.created_time,
        updated_time: plan.updated_time
      };
      
      return successResponse(res, formattedPlan, '获取培训计划详情成功');
    } catch (error) {
      logger.error('获取培训计划详情失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
  
  // 创建培训计划
  async create(req: Request, res: Response): Promise<Response> {
    try {
      const { 
        name, 
        training_scope, 
        trainer, 
        training_mode, 
        training_category, 
        planned_participants, 
        planned_time, 
        training_hours, 
        assessment_method, 
        exam_method 
      } = req.body;
      
      if (!name) {
        return errorResponse(res, 400, '培训计划名称不能为空', null);
      }
      
      // 检查培训计划名称是否已存在
      const planRepository = AppDataSource.getRepository(TrainingPlan);
      const existingTrainingPlan = await planRepository.findOne({
        where: { name, is_deleted: 0 }
      });
      
      if (existingTrainingPlan) {
        return errorResponse(res, 400, '培训计划名称已存在', null);
      }
      
      // 开始事务
      const queryRunner = AppDataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();
      
      try {
        // 创建新培训计划
        const plan = new TrainingPlan();
        plan.name = name;
        plan.trainer = trainer;
        plan.training_mode = training_mode;
        plan.training_category = training_category;
        plan.planned_participants = planned_participants;
        plan.planned_time = planned_time ? new Date(planned_time) : null;
        plan.training_hours = training_hours;
        plan.assessment_method = assessment_method;
        plan.exam_method = exam_method;
        plan.status = 0; // 初始状态
        
        const savedPlan = await queryRunner.manager.save(plan);
        
        // 保存培训范围
        if (training_scope && training_scope.length > 0) {
          const scopeRepository = queryRunner.manager.getRepository(TrainingPlanScope);
          
          for (const scope of training_scope) {
            const newScope = new TrainingPlanScope();
            newScope.training_plan_id = savedPlan._id;
            
            if (scope.startsWith('branch_')) {
              newScope.ref_type = 1; // BRANCH
              newScope.branch_id = Number(scope.replace('branch_', ''));
            } else if (scope.startsWith('dept_')) {
              newScope.ref_type = 2; // PROJECT_DEPARTMENT
              newScope.project_department_id = Number(scope.replace('dept_', ''));
            }
            
            await scopeRepository.save(newScope);
          }
        }
        
        // 提交事务
        await queryRunner.commitTransaction();
        
        return successResponse(res, { id: savedPlan._id }, '创建培训计划成功');
      } catch (error) {
        // 回滚事务
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        // 释放查询运行器
        await queryRunner.release();
      }
    } catch (error) {
      logger.error('创建培训计划失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
  
  // 更新培训计划
  async update(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { 
        name, 
        training_scope, 
        trainer, 
        training_mode, 
        training_category, 
        planned_participants, 
        planned_time, 
        training_hours, 
        assessment_method, 
        exam_method 
      } = req.body;
      
      if (!name) {
        return errorResponse(res, 400, '培训计划名称不能为空', null);
      }
      
      const planRepository = AppDataSource.getRepository(TrainingPlan);
      
      // 检查培训计划是否存在
      const plan = await planRepository.findOne({
        where: { _id: Number(id), is_deleted: 0 }
      });
      
      if (!plan) {
        return errorResponse(res, 404, '培训计划不存在', null);
      }
      
      // 检查名称是否重复
      if (name !== plan.name) {
        const existingTrainingPlan = await planRepository.findOne({
          where: { name, is_deleted: 0 }
        });

        if (existingTrainingPlan) {
          return errorResponse(res, 400, '培训计划名称已存在', null);
        }
      }

      // 开始事务
      const queryRunner = AppDataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();
      
      try {
        // 更新培训计划信息
        plan.name = name;
        plan.trainer = trainer;
        plan.training_mode = training_mode;
        plan.training_category = training_category;
        plan.planned_participants = planned_participants;
        plan.planned_time = planned_time ? new Date(planned_time) : null;
        plan.training_hours = training_hours;
        plan.assessment_method = assessment_method;
        plan.exam_method = exam_method;
        
        await queryRunner.manager.save(plan);
        
        // 更新培训范围 - 先删除旧的
        await queryRunner.manager.delete(TrainingPlanScope, { training_plan_id: Number(id) });
        
        // 保存新的培训范围
        if (training_scope && training_scope.length > 0) {
          const scopeRepository = queryRunner.manager.getRepository(TrainingPlanScope);
          
          for (const scope of training_scope) {
            const newScope = new TrainingPlanScope();
            newScope.training_plan_id = Number(id);
            
            if (scope.startsWith('branch_')) {
              newScope.ref_type = 1; // BRANCH
              newScope.branch_id = Number(scope.replace('branch_', ''));
            } else if (scope.startsWith('dept_')) {
              newScope.ref_type = 2; // PROJECT_DEPARTMENT
              newScope.project_department_id = Number(scope.replace('dept_', ''));
            }
            
            await scopeRepository.save(newScope);
          }
        }
        
        // 提交事务
        await queryRunner.commitTransaction();
        
        return successResponse(res, { id: Number(id) }, '更新培训计划成功');
      } catch (error) {
        // 回滚事务
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        // 释放查询运行器
        await queryRunner.release();
      }
    } catch (error) {
      logger.error('更新培训计划失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 删除培训计划（软删除）
  async delete(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      
      const planRepository = AppDataSource.getRepository(TrainingPlan);
      
      // 检查培训计划是否存在
      const plan = await planRepository.findOne({
        where: { _id: Number(id), is_deleted: 0 }
      });
      
      if (!plan) {
        return errorResponse(res, 404, '培训计划不存在', null);
      }
      
      // 软删除培训计划
      plan.is_deleted = 1;
      await planRepository.save(plan);
      
      return successResponse(res, null, '删除培训计划成功');
    } catch (error) {
      logger.error('删除培训计划失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
  
  // 批量删除培训计划（软删除）
  async batchDelete(req: Request, res: Response): Promise<Response> {
    try {
      const { ids } = req.body;
      
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return errorResponse(res, 400, '请选择要删除的培训计划', null);
      }
      
      const planRepository = AppDataSource.getRepository(TrainingPlan);
      
      // 查找所有要删除的培训计划
      const plans = await planRepository.find({
        where: ids.map(id => ({ _id: id, is_deleted: 0 }))
      });
      
      if (plans.length === 0) {
        return errorResponse(res, 404, '未找到要删除的培训计划', null);
      }
      
      // 软删除所有培训计划
      for (const plan of plans) {
        plan.is_deleted = 1;
      }
      
      await planRepository.save(plans);
      
      return successResponse(res, null, '批量删除培训计划成功');
    } catch (error) {
      logger.error('批量删除培训计划失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
}