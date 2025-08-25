import { Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';
import { AppDataSource } from '../config/database';
import { ConstructionWorker } from '../models/entities/ConstructionWorker.entity';
import { Courseware } from '../models/entities/Courseware.entity';
import { ExamRecord } from '../models/entities/ExamRecord.entity';
import { CoursewareMaterial } from '../models/entities/CoursewareMaterial.entity';
import { TrainingRecordProgressDetail } from '../models/entities/TrainingRecordProgressDetail.entity';
import { User } from '../models/entities/User.entity';
import { ProjectDepartmentMember } from '../models/entities/ProjectDepartmentMember.entity';
import { TrainingRecordCourseware } from '../models/entities/TrainingRecordCourseware.entity';
import { TrainingRecordParticipant } from '../models/entities/TrainingRecordParticipant.entity';
import { TrainingRecordProgress } from '../models/entities/TrainingRecordProgress.entity';
import { logger } from '../utils/logger';
import { errorResponse, successResponse } from '../utils/response';

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

      // 生成 JWT 令牌
      const token = jwt.sign(
        {
          id: user._id
        },
        process.env.JWT_SECRET || 'EA(@eroiw302sodD03p21',
        { expiresIn: '24h' }
      );

      // 返回用户信息和令牌
      return successResponse(res, {
        token,
        user: {
          id: user._id,
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

  // 微信用户登录
  async wechatLogin(req: Request, res: Response): Promise<Response> {
    try {
      const { code } = req.body;
      
      if (!code) {
        return errorResponse(res, 400, '缺少微信登录凭证');
      }
      
      if (!WECHAT_CONFIG.appId || !WECHAT_CONFIG.appSecret) {
        return errorResponse(res, 500, '缺少微信配置，请提供 appId 和 appSecret');
      }

      const user = {
        id: 'wechat_test',
        type: 2,
        nickname: 'Test User',
        avatar: 'https://example.com/avatar.png',
        wechat_openid: 'wechat_test_openid',
      }
      const token = this.generateJwtToken(user, 'wechat');

      return successResponse(res, {
        token,
        userInfo: {
          id: user.id,
          nickname: user.nickname,
          avatar: user.avatar,
          openid: user.wechat_openid,
          loginType: 'wechat'
        }
      }, '微信登录成功');
      
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

  // 获取用户培训计划详情
  async myPlanDetail(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;

      const user = (req as any).user;
      if (!user) {
        return errorResponse(res, 401, '未认证', null);
      }

      const userType = user.type === 2 ? 2 : 1;      
      const planBuilder = AppDataSource.getRepository(TrainingRecordParticipant)
        .createQueryBuilder('participant')
        .innerJoinAndSelect('participant.training_record', 'record')
        .innerJoinAndSelect('record.training_plan', 'plan')
        .innerJoinAndSelect('plan.trainer', 'trainer')
        .where('record.status = 1')
        .andWhere('plan.is_deleted = 0');
        
      if (userType === 1) {
        planBuilder.andWhere('participant.user_id = :userId', { userId: user.id });
      } else {
        planBuilder.andWhere('participant.worker_id = :workerId', { workerId: user.id });
      }

      const plan = await planBuilder
        .andWhere('participant.training_record_id = :recordId', { recordId: id })
        .getOne();

      if (!plan) {
        return errorResponse(res, 404, '培训计划不存在', null);
      }

      // 获取培训记录对应课件列表
      const coursewareData = await AppDataSource.getRepository(TrainingRecordCourseware)
        .createQueryBuilder('recordCourseware')
        .innerJoinAndSelect('recordCourseware.courseware', 'courseware')
        .where('recordCourseware.training_record_id = :recordId', { recordId: plan.training_record_id })
        .andWhere('courseware.is_deleted = :is_deleted', { is_deleted: 0 })
        .andWhere('courseware.status = :status', { status: 1 })
        .orderBy('recordCourseware.sort', 'ASC')
        .getMany();

      // 获取培训记录对应进度列表
      const progressData = await AppDataSource.getRepository(TrainingRecordProgress)
        .createQueryBuilder('progress')
        .where('progress.training_record_participant_id = :participantId', { participantId: plan.id })
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
        .andWhere('record.participant_id = :participant', { participant: plan.id })
        .getOne();

      // 计算总进度
      const eachProgress = 100 / (coursewares.length + (exam ? 1 : 0));
      let totalProgress = 0
      coursewares.forEach(item => {
        totalProgress += Math.round(eachProgress * (item.progress / 100));
      })

      const formattedPlanDetail = {
					id: plan.id,
					title: plan.training_record.training_plan.name,
					description: plan.training_record.training_plan.description,
					fullDescription: plan.training_record.training_plan.full_description,
					cover: plan.training_record.training_plan.cover,
					status: totalProgress >= 100 ? 'completed' : 'in_progress',
					progress: totalProgress,
          isSignin: plan.is_signin,
					courseCount: coursewares.length,
					totalDuration,
					difficulty: plan.training_record.training_plan.difficulty,
					type: plan.training_record.training_plan.training_category,
					startDate: plan.training_record.training_plan.planned_time,
					deadline: plan.training_record.training_plan.planned_time,
					instructor: plan.training_record.training_plan.trainer.name,
					isFavorited: false,
					tags: [],
					objectives: plan.training_record.training_plan.objectives?.split(",,"),
					hasExam: exam ? true : false,
					examTitle: exam?.examEntity.title,
					examDesc: exam?.examEntity.description,
					examQuestionCount: exam?.examEntity.question_count,
					examDuration: exam?.examEntity.duration,
					examPassScore: exam?.examEntity.pass_score,
					courses: coursewares
				}

      return successResponse(res, formattedPlanDetail, '获取培训计划详情成功');
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

      const progressBuilder = AppDataSource.getRepository(TrainingRecordProgress)
        .createQueryBuilder('progress')
        .where('progress.courseware_id = :coursewareId', { coursewareId: courseId })
        .andWhere('progress.training_record_participant_id = :partId', { partId: partId });
      
      let progressId = 0;
      const progress = await progressBuilder.getOne();

      if (!progress) {
        const newProgress = new TrainingRecordProgress();
        newProgress.courseware_id = Number(courseId);
        newProgress.training_record_participant_id = Number(partId);
        newProgress.progress = 0;
        const savedProgress = await AppDataSource.manager.save(newProgress);
        progressId = savedProgress.id || 0;
      } else {
        progressId = progress.id || 0;
      }

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
          .andWhere('detail.material_id = :materialId', { materialId: partId });
        
        const details = await detailsBuilder.getMany();
        details.forEach(item => {
          chapterProgressMap.set(item.material_id, item);
        })
      }
      
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
      const userType = user.type === 2 ? 2 : 1;      
      const id = req.params.id;
      const plan = await AppDataSource.getRepository(TrainingRecordParticipant)
        .createQueryBuilder('participant')
        .where('participant.id = :participantId', { participantId: id })
        .getOne();

      if (!plan) {
        return errorResponse(res, 404, '培训计划不存在', null);
      }

      if (userType === 1) {
        if (plan.user_id !== user.id) {
          return errorResponse(res, 403, '无权限', null);
        }
      } else {
        if (plan.worker_id !== user.id) {
          return errorResponse(res, 403, '无权限', null);
        }
      }

      if (plan.is_signin) {
        return errorResponse(res, 400, '已签到', null);
      }
      plan.is_signin = 1;
      await AppDataSource.getRepository(TrainingRecordParticipant).save(plan);
      return successResponse(res, null, '签到成功');
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
      // 更新课程进度
      // const progressRecord = await AppDataSource.getRepository(TrainingRecordProgress)
      //   .createQueryBuilder('progress')
      //   .where('progress.id = :progressId', { progressId: progressId })
      //   .getOne();
      // if (progressRecord) {
      //   progressRecord.progress = Number(progress.progress);
      //   await AppDataSource.getRepository(TrainingRecordProgress).save(progressRecord);
      // }

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
   * 生成用户 JWT 令牌
   */
  private generateJwtToken(user: any, type: string): string {

    const payload = {
      userId: user.id,
      openid: user.wechat_openid,
      loginType: 'wechat',
      iat: Math.floor(Date.now() / 1000)
    };
    
    const options: jwt.SignOptions = {
      expiresIn: '7d' // Fixed expiration time
    };
    
    return jwt.sign(payload, JWT_SECRET, options);
  }
}