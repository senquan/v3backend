import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Task, TaskType, TaskStatus, TaskPriority } from '../models/entities/Task.entity';
import { TaskItem, TaskItemType, TaskItemStatus } from '../models/entities/TaskItem.entity';
import { TaskAssignment, AssignmentType, AssignmentStatus } from '../models/entities/TaskAssignment.entity';
import { TaskProgress, ProgressStatus } from '../models/entities/TaskProgress.entity';
import { User } from '../models/entities/User.entity';
import { Courseware } from '../models/entities/Courseware.entity';
import { Exam } from '../models/entities/Exam.entity';
import { Like, In, Between, IsNull, Not } from 'typeorm';
import { logger } from '../utils/logger';
import { successResponse, errorResponse } from '../utils/response';

class TaskController {
  private taskRepository = AppDataSource.getRepository(Task);
  private taskItemRepository = AppDataSource.getRepository(TaskItem);
  private taskAssignmentRepository = AppDataSource.getRepository(TaskAssignment);
  private taskProgressRepository = AppDataSource.getRepository(TaskProgress);
  private userRepository = AppDataSource.getRepository(User);
  private coursewareRepository = AppDataSource.getRepository(Courseware);
  private examRepository = AppDataSource.getRepository(Exam);

  // 获取任务列表
  async getTasks(req: Request, res: Response) {
    try {
      const {
        page = 1,
        pageSize = 10,
        title,
        type,
        status,
        priority,
        creator,
        start_date,
        end_date,
        tags
      } = req.query;

      const queryBuilder = this.taskRepository.createQueryBuilder('task')
        .leftJoinAndSelect('task.creatorEntity', 'creator')
        .leftJoinAndSelect('task.updaterEntity', 'updater')
        .leftJoinAndSelect('task.taskItems', 'taskItems')
        .leftJoinAndSelect('task.taskAssignments', 'taskAssignments')
        .where('task.is_deleted = :isDeleted', { isDeleted: 0 });

      // 条件筛选
      if (title) {
        queryBuilder.andWhere('task.title LIKE :title', { title: `%${title}%` });
      }

      if (type) {
        queryBuilder.andWhere('task.type = :type', { type });
      }

      if (status) {
        queryBuilder.andWhere('task.status = :status', { status });
      }

      if (priority) {
        queryBuilder.andWhere('task.priority = :priority', { priority });
      }

      if (creator) {
        queryBuilder.andWhere('task.creator = :creator', { creator });
      }

      if (start_date && end_date) {
        queryBuilder.andWhere('task.start_time BETWEEN :startDate AND :endDate', {
          startDate: start_date,
          endDate: end_date
        });
      }

      if (tags) {
        queryBuilder.andWhere('task.tags LIKE :tags', { tags: `%${tags}%` });
      }

      // 分页
      const offset = (Number(page) - 1) * Number(pageSize);
      queryBuilder.skip(offset).take(Number(pageSize));

      // 排序
      queryBuilder.orderBy('task.created_time', 'DESC');

      const [tasks, total] = await queryBuilder.getManyAndCount();

      // 计算统计信息
      const tasksWithStats = await Promise.all(tasks.map(async (task) => {
        const assignmentStats = await this.taskAssignmentRepository
          .createQueryBuilder('assignment')
          .select([
            'COUNT(*) as total_assignments',
            'SUM(CASE WHEN assignment.status = :completed THEN 1 ELSE 0 END) as completed_assignments',
            'AVG(assignment.progress) as avg_progress'
          ])
          .where('assignment.task_id = :taskId', { taskId: task._id })
          .andWhere('assignment.is_deleted = :isDeleted', { isDeleted: 0 })
          .setParameter('completed', AssignmentStatus.COMPLETED)
          .getRawOne();

        return {
          ...task,
          total_assignments: Number(assignmentStats.total_assignments) || 0,
          completed_assignments: Number(assignmentStats.completed_assignments) || 0,
          avg_progress: Number(assignmentStats.avg_progress) || 0,
          completion_rate: assignmentStats.total_assignments > 0 
            ? (Number(assignmentStats.completed_assignments) / Number(assignmentStats.total_assignments) * 100).toFixed(2)
            : '0.00'
        };
      }));

      return successResponse(res, {
        tasks: tasksWithStats,
        total,
        page: Number(page),
        pageSize: Number(pageSize)
      }, '获取任务列表成功');
    } catch (error) {
      logger.error('获取任务列表失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 获取任务详情
  async getTaskById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const task = await this.taskRepository.findOne({
        where: { _id: Number(id), is_deleted: 0 },
        relations: [
          'creatorEntity',
          'updaterEntity',
          'taskItems',
          'taskItems.courseware',
          'taskItems.exam',
          'taskItems.creatorEntity',
          'taskAssignments',
          'taskAssignments.user',
          'taskAssignments.department',
          'taskAssignments.assignerEntity'
        ]
      });

      if (!task) {
        return res.status(404).json({
          code: 404,
          message: '任务不存在'
        });
      }

      // 获取任务统计信息
      const stats = await this.getTaskStatistics(task._id);

      res.json({
        code: 0,
        message: '获取任务详情成功',
        data: {
          ...task,
          ...stats
        }
      });
    } catch (error) {
      console.error('获取任务详情失败:', error);
      res.status(500).json({
        code: 500,
        message: '获取任务详情失败',
        error: error instanceof Error ? error.message : '未知错误'
      });
    }
  }

  // 获取任务学习内容
  async getTaskLearningContent(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?._id || 1; // 从认证中间件获取用户ID
      
      // 获取任务详情
      const task = await this.taskRepository.findOne({
        where: { _id: Number(id), is_deleted: 0 },
        relations: [
          'taskItems',
          'taskItems.courseware',
          'taskItems.exam',
          'taskItems.creatorEntity',
          'taskAssignments'
        ]
      });

      if (!task) {
        return errorResponse(res, 404, '任务不存在', null);
      }

      // 获取用户的学习进度
      const progressRepository = AppDataSource.getRepository('TaskProgress');
      const progressList = await progressRepository.find({
        where: {
          task_id: Number(id),
          user_id: userId,
          is_deleted: 0
        }
      });

      // 获取任务分配信息
      const assignment = task.taskAssignments?.find(assign => 
        assign.user_id === userId && assign.status !== AssignmentStatus.CANCELLED
      );

      // 构建学习任务数据结构
      const learningTask = {
        _id: task._id,
        title: task.title,
        description: task.description,
        taskItems: task.taskItems || [],
        assignment: assignment || null,
        progress: progressList || []
      };

      return successResponse(res, learningTask, '获取任务学习内容成功');
    } catch (error) {
      console.error('获取任务学习内容失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 创建任务
  async createTask(req: Request, res: Response) {
    try {
      const {
        title,
        description,
        type,
        priority,
        start_time,
        end_time,
        publish_time,
        expected_participants,
        allow_makeup,
        auto_assign,
        auto_assign_rules,
        task_config,
        tags,
        remark,
        taskItems = [],
        assignments = []
      } = req.body;

      const userId = (req as any).user?._id || 1; // 从认证中间件获取用户ID

      // 验证必填字段
      if (!title || !type) {
        return res.status(400).json({
          code: 400,
          message: '任务标题和类型为必填项'
        });
      }

      // 验证时间逻辑
      if (start_time && end_time && new Date(start_time) >= new Date(end_time)) {
        return res.status(400).json({
          code: 400,
          message: '开始时间必须早于结束时间'
        });
      }

      const queryRunner = AppDataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        // 创建任务
        const task = new Task();
        task.title = title;
        task.description = description;
        task.task_type = type;
        task.priority = priority || TaskPriority.NORMAL;
        task.status = TaskStatus.DRAFT;
        task.start_time = start_time ? new Date(start_time) : null;
        task.end_time = end_time ? new Date(end_time) : null;
        task.publish_time = publish_time ? new Date(publish_time) : null;
        task.expected_participants = expected_participants || 0;
        task.allow_makeup = allow_makeup || false;
        task.auto_assign = auto_assign || false;
        task.auto_assign_rules = auto_assign_rules;
        task.task_config = task_config;
        task.tags = tags;
        task.remark = remark;
        task.creator = userId;

        const savedTask = await queryRunner.manager.save(task);

        // 创建任务项
        if (taskItems.length > 0) {
          for (const itemData of taskItems) {
            const taskItem = new TaskItem();
            taskItem.task_id = savedTask._id;
            taskItem.title = itemData.title;
            taskItem.description = itemData.description;
            taskItem.item_type = itemData.item_type;
            taskItem.status = itemData.status || TaskItemStatus.ACTIVE;
            taskItem.courseware_id = itemData.courseware_id;
            taskItem.exam_id = itemData.exam_id;
            taskItem.survey_id = itemData.survey_id;
            taskItem.external_url = itemData.external_url;
            taskItem.sort_order = itemData.sort_order || 1;
            taskItem.is_required = itemData.is_required !== false;
            taskItem.required_duration = itemData.required_duration || 0;
            taskItem.pass_score = itemData.pass_score || 0;
            taskItem.max_attempts = itemData.max_attempts || 1;
            taskItem.start_time = itemData.start_time ? new Date(itemData.start_time) : null;
            taskItem.end_time = itemData.end_time ? new Date(itemData.end_time) : null;
            taskItem.item_config = itemData.item_config;
            taskItem.weight = itemData.weight || 0;
            taskItem.completion_criteria = itemData.completion_criteria;
            taskItem.remark = itemData.remark;
            taskItem.creator = userId;

            await queryRunner.manager.save(taskItem);
          }
        }

        // 创建任务分配
        if (assignments.length > 0) {
          for (const assignmentData of assignments) {
            const assignment = new TaskAssignment();
            assignment.task_id = savedTask._id;
            assignment.assignment_type = assignmentData.assignment_type;
            assignment.user_id = assignmentData.user_id;
            assignment.department_id = assignmentData.department_id;
            assignment.role_name = assignmentData.role_name;
            assignment.status = AssignmentStatus.PENDING;
            assignment.deadline = assignmentData.deadline ? new Date(assignmentData.deadline) : null;
            assignment.remark = assignmentData.remark;
            assignment.assigner = userId;

            await queryRunner.manager.save(assignment);
          }
        }

        await queryRunner.commitTransaction();

        // 获取完整的任务信息
        const fullTask = await this.taskRepository.findOne({
          where: { _id: savedTask._id },
          relations: ['creatorEntity', 'taskItems', 'taskAssignments']
        });

        res.status(200).json({
          code: 0,
          message: '创建任务成功',
          data: fullTask
        });
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }
    } catch (error) {
      console.error('创建任务失败:', error);
      res.status(500).json({
        code: 500,
        message: '创建任务失败',
        error: error instanceof Error ? error.message : '未知错误'
      });
    }
  }

  // 更新任务
  async updateTask(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const userId = (req as any).user?._id || 1;

      const task = await this.taskRepository.findOne({
        where: { _id: Number(id), is_deleted: 0 }
      });

      if (!task) {
        return res.status(404).json({
          code: 404,
          message: '任务不存在'
        });
      }

      // 验证时间逻辑
      const startTime = updateData.start_time || task.start_time;
      const endTime = updateData.end_time || task.end_time;
      if (startTime && endTime && new Date(startTime) >= new Date(endTime)) {
        return res.status(400).json({
          code: 400,
          message: '开始时间必须早于结束时间'
        });
      }

      // 更新任务基本信息
      Object.assign(task, {
        ...updateData,
        start_time: updateData.start_time ? new Date(updateData.start_time) : task.start_time,
        end_time: updateData.end_time ? new Date(updateData.end_time) : task.end_time,
        publish_time: updateData.publish_time ? new Date(updateData.publish_time) : task.publish_time,
        updater: userId,
        updated_time: new Date()
      });

      const updatedTask = await this.taskRepository.save(task);

      res.json({
        code: 0,
        message: '更新任务成功',
        data: updatedTask
      });
    } catch (error) {
      console.error('更新任务失败:', error);
      res.status(500).json({
        code: 500,
        message: '更新任务失败',
        error: error instanceof Error ? error.message : '未知错误'
      });
    }
  }

  // 删除任务
  async deleteTask(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?._id || 1;

      const task = await this.taskRepository.findOne({
        where: { _id: Number(id), is_deleted: 0 }
      });

      if (!task) {
        return res.status(404).json({
          code: 404,
          message: '任务不存在'
        });
      }

      // 软删除
      task.is_deleted = 1;
      task.updater = userId;
      task.updated_time = new Date();

      await this.taskRepository.save(task);

      res.json({
        code: 0,
        message: '删除任务成功'
      });
    } catch (error) {
      console.error('删除任务失败:', error);
      res.status(500).json({
        code: 500,
        message: '删除任务失败',
        error: error instanceof Error ? error.message : '未知错误'
      });
    }
  }

  // 批量删除任务
  async batchDeleteTasks(req: Request, res: Response) {
    try {
      const { ids } = req.body;
      const userId = (req as any).user?._id || 1;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          code: 400,
          message: '请提供要删除的任务ID列表'
        });
      }

      await this.taskRepository.update(
        { _id: In(ids), is_deleted: 0 },
        {
          is_deleted: 1,
          updater: userId,
          updated_time: new Date()
        }
      );

      res.json({
        code: 0,
        message: `成功删除 ${ids.length} 个任务`
      });
    } catch (error) {
      console.error('批量删除任务失败:', error);
      res.status(500).json({
        code: 500,
        message: '批量删除任务失败',
        error: error instanceof Error ? error.message : '未知错误'
      });
    }
  }

  // 发布任务
  async publishTask(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?._id || 1;

      const task = await this.taskRepository.findOne({
        where: { _id: Number(id), is_deleted: 0 },
        relations: ['taskItems', 'taskAssignments']
      });

      if (!task) {
        return res.status(404).json({
          code: 404,
          message: '任务不存在'
        });
      }

      if (task.status !== TaskStatus.DRAFT) {
        return res.status(400).json({
          code: 400,
          message: '只能发布草稿状态的任务'
        });
      }

      // 验证任务是否完整
      if (task.taskItems.length === 0) {
        return res.status(400).json({
          code: 400,
          message: '任务必须包含至少一个任务项'
        });
      }

      if (task.taskAssignments.length === 0) {
        return res.status(400).json({
          code: 400,
          message: '任务必须分配给至少一个用户或部门'
        });
      }

      // 更新任务状态
      task.status = TaskStatus.PUBLISHED;
      task.publish_time = new Date();
      task.updater = userId;
      task.updated_time = new Date();

      await this.taskRepository.save(task);

      res.json({
        code: 0,
        message: '发布任务成功',
        data: task
      });
    } catch (error) {
      console.error('发布任务失败:', error);
      res.status(500).json({
        code: 500,
        message: '发布任务失败',
        error: error instanceof Error ? error.message : '未知错误'
      });
    }
  }

  // 分配学员到任务
  async assignStudentsToTask(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { userIds, departmentIds, reason } = req.body;
      const userId = (req as any).user?._id || 1;

      // 验证任务是否存在
      const task = await this.taskRepository.findOne({
        where: { _id: Number(id), is_deleted: 0 }
      });

      if (!task) {
        return res.status(404).json({
          code: 404,
          message: '任务不存在'
        });
      }

      const queryRunner = AppDataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        const assignments = [];

        // 处理用户分配
        if (userIds && Array.isArray(userIds) && userIds.length > 0) {
          for (const studentId of userIds) {
            // 检查是否已经分配过
            const existingAssignment = await queryRunner.manager.findOne(TaskAssignment, {
              where: {
                task_id: Number(id),
                user_id: studentId,
                is_deleted: 0
              }
            });

            if (!existingAssignment) {
              const assignment = new TaskAssignment();
              assignment.task_id = Number(id);
              assignment.assignment_type = AssignmentType.USER;
              assignment.user_id = studentId;
              assignment.status = AssignmentStatus.PENDING;
              assignment.deadline = task.end_time;
              assignment.assigner = userId;
              assignment.remark = reason || '手动分配学员';
              
              assignments.push(assignment);
            }
          }
        }

        // 处理部门分配
        if (departmentIds && Array.isArray(departmentIds) && departmentIds.length > 0) {
          for (const deptId of departmentIds) {
            // 检查是否已经分配过
            const existingAssignment = await queryRunner.manager.findOne(TaskAssignment, {
              where: {
                task_id: Number(id),
                department_id: deptId,
                is_deleted: 0
              }
            });

            if (!existingAssignment) {
              const assignment = new TaskAssignment();
              assignment.task_id = Number(id);
              assignment.assignment_type = AssignmentType.DEPARTMENT;
              assignment.department_id = deptId;
              assignment.status = AssignmentStatus.PENDING;
              assignment.deadline = task.end_time;
              assignment.assigner = userId;
              assignment.remark = reason || '手动分配部门';
              
              assignments.push(assignment);
            }
          }
        }

        // 批量保存分配记录
        if (assignments.length > 0) {
          await queryRunner.manager.save(TaskAssignment, assignments);
        }

        await queryRunner.commitTransaction();

        res.json({
          code: 0,
          message: `成功分配 ${assignments.length} 个学员/部门到任务`,
          data: {
            assignedCount: assignments.length,
            taskId: Number(id)
          }
        });
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }
    } catch (error) {
      console.error('分配学员失败:', error);
      res.status(500).json({
        code: 500,
        message: '分配学员失败',
        error: error instanceof Error ? error.message : '未知错误'
      });
    }
  }

  // 获取任务统计信息
  private async getTaskStatistics(taskId: number) {
    const assignmentStats = await this.taskAssignmentRepository
      .createQueryBuilder('assignment')
      .select([
        'COUNT(*) as total_assignments',
        'SUM(CASE WHEN assignment.status = :pending THEN 1 ELSE 0 END) as pending_assignments',
        'SUM(CASE WHEN assignment.status = :inProgress THEN 1 ELSE 0 END) as in_progress_assignments',
        'SUM(CASE WHEN assignment.status = :completed THEN 1 ELSE 0 END) as completed_assignments',
        'SUM(CASE WHEN assignment.status = :overdue THEN 1 ELSE 0 END) as overdue_assignments',
        'AVG(assignment.progress) as avg_progress',
        'AVG(assignment.achieved_score) as avg_score'
      ])
      .where('assignment.task_id = :taskId', { taskId })
      .andWhere('assignment.is_deleted = :isDeleted', { isDeleted: 0 })
      .setParameters({
        pending: AssignmentStatus.PENDING,
        inProgress: AssignmentStatus.IN_PROGRESS,
        completed: AssignmentStatus.COMPLETED,
        overdue: AssignmentStatus.OVERDUE
      })
      .getRawOne();

    return {
      total_assignments: Number(assignmentStats.total_assignments) || 0,
      pending_assignments: Number(assignmentStats.pending_assignments) || 0,
      in_progress_assignments: Number(assignmentStats.in_progress_assignments) || 0,
      completed_assignments: Number(assignmentStats.completed_assignments) || 0,
      overdue_assignments: Number(assignmentStats.overdue_assignments) || 0,
      avg_progress: Number(assignmentStats.avg_progress) || 0,
      avg_score: Number(assignmentStats.avg_score) || 0,
      completion_rate: assignmentStats.total_assignments > 0 
        ? (Number(assignmentStats.completed_assignments) / Number(assignmentStats.total_assignments) * 100).toFixed(2)
        : '0.00'
    };
  }

  // 完成任务项
  async completeTaskItem(req: Request, res: Response) {
    try {
      const { id } = req.params; // 任务ID
      const { task_item_id, progress = 100, score, duration } = req.body;
      let { completionData } = req.body;
      const userId = (req as any).user?._id || 1; // 从认证中间件获取用户ID
    
      // 验证必填字段
      if (!task_item_id) {
        return res.status(400).json({
          code: 400,
          message: '任务项ID不能为空'
        });
      }
    
      // 验证任务是否存在
      const task = await this.taskRepository.findOne({
        where: { _id: Number(id), is_deleted: 0 },
        relations: ['taskItems']
      });
    
      if (!task) {
        return res.status(404).json({
          code: 404,
          message: '任务不存在'
        });
      }
    
      // 验证任务项是否存在
      const taskItem = task.taskItems?.find(item => item._id === Number(task_item_id));
      if (!taskItem) {
        return res.status(404).json({
          code: 404,
          message: '任务项不存在'
        });
      }
    
      // 验证用户是否有权限完成此任务
      const assignment = await this.taskAssignmentRepository.findOne({
        where: {
          task_id: Number(id),
          user_id: userId,
          status: Not(AssignmentStatus.CANCELLED),
          is_deleted: 0
        }
      });
    
      if (!assignment) {
        return res.status(403).json({
          code: 403,
          message: '您没有权限完成此任务'
        });
      }

      // 默认完成时间
      if (!completionData) completionData = new Date();
    
      // 检查是否已经有进度记录
      let taskProgress = await this.taskProgressRepository.findOne({
        where: {
          task_id: Number(id),
          task_item_id: Number(task_item_id),
          user_id: userId,
          is_deleted: 0
        }
      });
    
      const queryRunner = AppDataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();
    
      try {
        if (taskProgress) {
          // 更新现有进度记录
          taskProgress.progress = Math.max(taskProgress.progress, progress);
          taskProgress.status = progress >= 100 ? ProgressStatus.COMPLETED : ProgressStatus.IN_PROGRESS;
          taskProgress.score = score || taskProgress.max_score;
          taskProgress.study_duration = (taskProgress.study_duration || 0) + (duration || 0);
          taskProgress.completion_time = progress >= 100 ? new Date() : taskProgress.completion_time;
          // taskProgress.completion_data = completionData || taskProgress.completion_data;
          taskProgress.updated_time = new Date();
        } else {
          // 创建新的进度记录
          taskProgress = new TaskProgress();
          taskProgress.task_id = Number(id);
          taskProgress.task_item_id = Number(task_item_id);
          taskProgress.user_id = userId;
          taskProgress.progress = progress;
          taskProgress.status = progress >= 100 ? ProgressStatus.COMPLETED : ProgressStatus.IN_PROGRESS;
          taskProgress.score = score || taskProgress.max_score;
          taskProgress.study_duration = duration || 0;
          taskProgress.start_time = new Date();
          taskProgress.completion_time = progress >= 100 ? new Date() : null;
          // taskProgress.completion_data = completionData;
        }
    
        await queryRunner.manager.save(TaskProgress, taskProgress);
    
        // 检查任务是否全部完成，更新任务分配状态
        if (progress >= 100) {
          const allTaskItems = task.taskItems.filter(item => item.is_required);
          const completedItems = await queryRunner.manager.find(TaskProgress, {
            where: {
              task_id: Number(id),
              user_id: userId,
              status: ProgressStatus.COMPLETED,
              is_deleted: 0
            }
          });
    
          const completedRequiredItems = completedItems.filter(progress => 
            allTaskItems.some(item => item._id === progress.task_item_id)
          );
    
          if (completedRequiredItems.length >= allTaskItems.length) {
            // 所有必需任务项都已完成，更新任务分配状态
            assignment.status = AssignmentStatus.COMPLETED;
            assignment.completion_time = new Date();
            assignment.progress = 100;
            
            // 计算总分
            const totalScore = completedItems.reduce((sum, item) => sum + (item.score || 0), 0);
            assignment.achieved_score = totalScore;
            
            await queryRunner.manager.save(TaskAssignment, assignment);
          } else {
            // 更新进度百分比
            const progressPercentage = Math.round((completedRequiredItems.length / allTaskItems.length) * 100);
            assignment.progress = progressPercentage;
            assignment.status = AssignmentStatus.IN_PROGRESS;
            await queryRunner.manager.save(TaskAssignment, assignment);
          }
        }
    
        await queryRunner.commitTransaction();
    
        return successResponse(res, {
          taskProgress,
          assignment: {
            status: assignment.status,
            progress: assignment.progress,
            achieved_score: assignment.achieved_score
          }
        }, '任务项完成状态更新成功');
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }
    } catch (error) {
      console.error('完成任务项失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
}

export default new TaskController();
