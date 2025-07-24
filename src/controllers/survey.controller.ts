import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Survey } from '../models/entities/Survey.entity';
import { SurveyQuestion } from '../models/entities/SurveyQuestion.entity';
import { SurveyQuestionOption } from '../models/entities/SurveyQuestionOption.entity';
import { SurveySubmission } from '../models/entities/SurveySubmission.entity';
import { SurveyAnswer } from '../models/entities/SurveyAnswer.entity';
import { logger } from '../utils/logger';
import { errorResponse, successResponse } from '../utils/response';

export class SurveyController {
  // 获取问卷列表
  async getList(req: Request, res: Response): Promise<Response> {
    try {
      const { page = 1, pageSize = 20, keyword, category, status, sort } = req.query;
      
      // 构建查询条件
      const queryBuilder = AppDataSource.getRepository(Survey)
        .createQueryBuilder('survey')
        .leftJoinAndSelect('survey.creatorEntity', 'creator')
        .leftJoinAndSelect('survey.updaterEntity', 'updater')
        .where('survey.is_deleted = :is_deleted', { is_deleted: 0 });
      
      // 添加筛选条件
      if (keyword) {
        queryBuilder.andWhere('(survey.title LIKE :keyword OR survey.description LIKE :keyword)', { keyword: `%${keyword}%` });
      }

      if (category) {
        queryBuilder.andWhere('survey.category = :category', { category: Number(category) });
      }

      if (status !== undefined && status !== '') {
        queryBuilder.andWhere('survey.status = :status', { status: Number(status) });
      }

      // 添加排序
      if (sort) {
        const order = String(sort).substring(0, 1);
        const field = String(sort).substring(1);
        if (field && order) {
          queryBuilder.orderBy(`survey.${field}`, order === "+" ? "ASC" : "DESC");
        }
      } else {
        queryBuilder.orderBy('survey.created_time', 'DESC');
      }

      // 分页
      const total = await queryBuilder.getCount();
      const surveys = await queryBuilder
        .skip((Number(page) - 1) * Number(pageSize))
        .take(Number(pageSize))
        .getMany();

      // 格式化返回数据
      const formattedSurveys = surveys.map(survey => ({
        id: survey._id,
        title: survey.title,
        description: survey.description,
        category: survey.category,
        status: survey.status,
        start_time: survey.start_time,
        end_time: survey.end_time,
        is_anonymous: survey.is_anonymous,
        max_submissions: survey.max_submissions,
        submission_count: survey.submission_count,
        view_count: survey.view_count,
        creator: survey.creatorEntity ? {
          id: survey.creatorEntity._id,
          name: survey.creatorEntity.name
        } : null,
        updater: survey.updaterEntity ? {
          id: survey.updaterEntity._id,
          name: survey.updaterEntity.name
        } : null,
        created_time: survey.created_time,
        updated_time: survey.updated_time
      }));

      return successResponse(res, {
        surveys: formattedSurveys,
        total,
        page: Number(page),
        pageSize: Number(pageSize)
      }, '获取问卷列表成功');
    } catch (error) {
      logger.error('获取问卷列表失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 获取问卷详情
  async getDetail(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      
      const survey = await AppDataSource.getRepository(Survey)
        .createQueryBuilder('survey')
        .leftJoinAndSelect('survey.creatorEntity', 'creator')
        .leftJoinAndSelect('survey.updaterEntity', 'updater')
        .leftJoinAndSelect('survey.questions', 'questions')
        .leftJoinAndSelect('questions.options', 'options')
        .where('survey._id = :id', { id: Number(id) })
        .andWhere('survey.is_deleted = :is_deleted', { is_deleted: 0 })
        .andWhere('questions.is_deleted = :questionDeleted', { questionDeleted: 0 })
        .andWhere('options.is_deleted = :optionDeleted', { optionDeleted: 0 })
        .orderBy('questions.sort_order', 'ASC')
        .getOne();
      
      if (!survey) {
        return errorResponse(res, 404, '问卷不存在', null);
      }

      // 更新查看次数
      survey.view_count += 1;
      await AppDataSource.getRepository(Survey).save(survey);
      
      // 格式化返回数据
      const formattedSurvey = {
        id: survey._id,
        title: survey.title,
        description: survey.description,
        category: survey.category,
        status: survey.status,
        start_time: survey.start_time,
        end_time: survey.end_time,
        is_anonymous: survey.is_anonymous,
        max_submissions: survey.max_submissions,
        submission_count: survey.submission_count,
        view_count: survey.view_count,
        questions: survey.questions.map(question => ({
          id: question._id,
          question_text: question.question_text,
          question_type: question.question_type,
          is_required: question.is_required,
          sort_order: question.sort_order,
          options: question.options.map(option => ({
            id: option._id,
            option_text: option.option_text,
            option_value: option.option_value
          }))
        })),
        creator: survey.creatorEntity ? {
          id: survey.creatorEntity._id,
          name: survey.creatorEntity.name
        } : null,
        updater: survey.updaterEntity ? {
          id: survey.updaterEntity._id,
          name: survey.updaterEntity.name
        } : null,
        created_time: survey.created_time,
        updated_time: survey.updated_time
      };

      return successResponse(res, formattedSurvey, '获取问卷详情成功');
    } catch (error) {
      logger.error('获取问卷详情失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 创建问卷
  async create(req: Request, res: Response): Promise<Response> {
    try {
      const { 
        title, 
        description, 
        category, 
        status,
        start_time,
        end_time,
        is_anonymous,
        max_submissions,
        questions
      } = req.body;
      
      if (!title) {
        return errorResponse(res, 400, '问卷标题不能为空', null);
      }
      
      // 检查问卷标题是否已存在
      const surveyRepository = AppDataSource.getRepository(Survey);
      const existingSurvey = await surveyRepository.findOne({
        where: { title, is_deleted: 0 }
      });
      
      if (existingSurvey) {
        return errorResponse(res, 400, '问卷标题已存在', null);
      }

      // 创建新问卷
      const newSurvey = surveyRepository.create({
        title,
        description,
        category: category ? Number(category) : 1,
        status: status ? Number(status) : 0,
        start_time: start_time ? new Date(start_time) : undefined,
        end_time: end_time ? new Date(end_time) : undefined,
        is_anonymous: is_anonymous ? Number(is_anonymous) : 0,
        max_submissions: max_submissions ? Number(max_submissions) : undefined,
        submission_count: 0,
        view_count: 0,
        creator: 1, // TODO: 从请求中获取用户ID
        is_deleted: 0
      });

      const savedSurvey = await surveyRepository.save(newSurvey);

      // 创建问题和选项
      if (questions && questions.length > 0) {
        const questionRepository = AppDataSource.getRepository(SurveyQuestion);
        const optionRepository = AppDataSource.getRepository(SurveyQuestionOption);
        
        for (const questionData of questions) {
          const question = questionRepository.create({
            survey_id: savedSurvey._id,
            question_text: questionData.question_text,
            question_type: questionData.question_type,
            is_required: questionData.is_required || 0,
            sort_order: questionData.sort_order,
            is_deleted: 0
          });
          
          const savedQuestion = await questionRepository.save(question);
          
          // 为选择题创建选项
          if ((questionData.question_type === 1 || questionData.question_type === 2) && questionData.options) {
            for (const optionData of questionData.options) {
              const option = optionRepository.create({
                question_id: savedQuestion._id,
                option_text: optionData.option_text,
                option_value: optionData.option_value,
                is_deleted: 0
              });
              
              await optionRepository.save(option);
            }
          }
        }
      }

      return successResponse(res, { id: savedSurvey._id }, '创建问卷成功');
    } catch (error) {
      logger.error('创建问卷失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 更新问卷
  async update(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { 
        title, 
        description, 
        category, 
        status,
        start_time,
        end_time,
        is_anonymous,
        max_submissions,
        questions
      } = req.body;
      
      if (!title) {
        return errorResponse(res, 400, '问卷标题不能为空', null);
      }
      
      const surveyRepository = AppDataSource.getRepository(Survey);
      
      // 检查问卷是否存在
      const survey = await surveyRepository.findOne({
        where: { _id: Number(id), is_deleted: 0 }
      });
      
      if (!survey) {
        return errorResponse(res, 404, '问卷不存在', null);
      }

      // 检查标题是否重复（排除自身）
      const existingSurvey = await surveyRepository.findOne({
        where: { title, is_deleted: 0 }
      });

      if (existingSurvey && existingSurvey._id !== Number(id)) {
        return errorResponse(res, 400, '问卷标题已存在', null);
      }

      // 更新问卷信息
      survey.title = title;
      survey.description = description;
      if (category !== undefined) survey.category = Number(category);
      if (status !== undefined) survey.status = Number(status);
      if (start_time) survey.start_time = new Date(start_time);
      if (end_time) survey.end_time = new Date(end_time);
      if (is_anonymous !== undefined) survey.is_anonymous = Number(is_anonymous);
      if (max_submissions !== undefined) survey.max_submissions = max_submissions ? Number(max_submissions) : undefined;
      survey.updater = 1; // TODO: 从请求中获取用户ID

      await surveyRepository.save(survey);

      // 更新问题和选项
      if (questions) {
        const questionRepository = AppDataSource.getRepository(SurveyQuestion);
        const optionRepository = AppDataSource.getRepository(SurveyQuestionOption);
        
        // 软删除现有问题和选项
        await questionRepository.update(
          { survey_id: survey._id },
          { is_deleted: 1 }
        );
        await optionRepository.createQueryBuilder()
          .update()
          .set({ is_deleted: 1 })
          .where('question_id IN (SELECT _id FROM survey_questions WHERE survey_id = :surveyId)', { surveyId: survey._id })
          .execute();
        
        // 创建新问题和选项
        for (const questionData of questions) {
          const question = questionRepository.create({
            survey_id: survey._id,
            question_text: questionData.question_text,
            question_type: questionData.question_type,
            is_required: questionData.is_required || 0,
            sort_order: questionData.sort_order,
            is_deleted: 0
          });
          
          const savedQuestion = await questionRepository.save(question);
          
          // 为选择题创建选项
          if ((questionData.question_type === 1 || questionData.question_type === 2) && questionData.options) {
            for (const optionData of questionData.options) {
              const option = optionRepository.create({
                question_id: savedQuestion._id,
                option_text: optionData.option_text,
                option_value: optionData.option_value,
                is_deleted: 0
              });
              
              await optionRepository.save(option);
            }
          }
        }
      }

      return successResponse(res, { id: survey._id }, '更新问卷成功');
    } catch (error) {
      logger.error('更新问卷失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 删除问卷
  async delete(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      
      const surveyRepository = AppDataSource.getRepository(Survey);
      
      // 检查问卷是否存在
      const survey = await surveyRepository.findOne({
        where: { _id: Number(id), is_deleted: 0 }
      });
      
      if (!survey) {
        return errorResponse(res, 404, '问卷不存在', null);
      }
      
      // 软删除问卷
      survey.is_deleted = 1;
      survey.updater = 1; // TODO: 从请求中获取用户ID
      await surveyRepository.save(survey);
      
      return successResponse(res, null, '删除问卷成功');
    } catch (error) {
      logger.error('删除问卷失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 批量删除问卷
  async batchDelete(req: Request, res: Response): Promise<Response> {
    try {
      const { ids } = req.body;
      
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return errorResponse(res, 400, '请选择要删除的问卷', null);
      }
      
      const surveyRepository = AppDataSource.getRepository(Survey);
      
      // 查找所有要删除的问卷
      const surveys = await surveyRepository.find({
        where: ids.map(id => ({ _id: id, is_deleted: 0 }))
      });
      
      if (surveys.length === 0) {
        return errorResponse(res, 404, '未找到要删除的问卷', null);
      }
      
      // 软删除所有问卷
      for (const survey of surveys) {
        survey.is_deleted = 1;
        survey.updater = 1; // TODO: 从请求中获取用户ID
      }
      
      await surveyRepository.save(surveys);
      
      return successResponse(res, null, `成功删除${surveys.length}个问卷`);
    } catch (error) {
      logger.error('批量删除问卷失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 发布问卷
  async publish(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      
      const surveyRepository = AppDataSource.getRepository(Survey);
      
      // 检查问卷是否存在
      const survey = await surveyRepository.findOne({
        where: { _id: Number(id), is_deleted: 0 }
      });
      
      if (!survey) {
        return errorResponse(res, 404, '问卷不存在', null);
      }
      
      if (survey.status === 1) {
        return errorResponse(res, 400, '问卷已发布', null);
      }
      
      // 发布问卷
      survey.status = 1;
      survey.updater = 1; // TODO: 从请求中获取用户ID
      await surveyRepository.save(survey);
      
      return successResponse(res, null, '发布问卷成功');
    } catch (error) {
      logger.error('发布问卷失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 结束问卷
  async end(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      
      const surveyRepository = AppDataSource.getRepository(Survey);
      
      // 检查问卷是否存在
      const survey = await surveyRepository.findOne({
        where: { _id: Number(id), is_deleted: 0 }
      });
      
      if (!survey) {
        return errorResponse(res, 404, '问卷不存在', null);
      }
      
      if (survey.status === 2) {
        return errorResponse(res, 400, '问卷已结束', null);
      }
      
      // 结束问卷
      survey.status = 2;
      survey.updater = 1; // TODO: 从请求中获取用户ID
      await surveyRepository.save(survey);
      
      return successResponse(res, null, '结束问卷成功');
    } catch (error) {
      logger.error('结束问卷失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 获取问卷提交记录
  async getSubmissions(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { page = 1, pageSize = 20 } = req.query;
      
      const surveyRepository = AppDataSource.getRepository(Survey);
      
      // 检查问卷是否存在
      const survey = await surveyRepository.findOne({
        where: { _id: Number(id), is_deleted: 0 }
      });
      
      if (!survey) {
        return errorResponse(res, 404, '问卷不存在', null);
      }
      
      // 构建查询条件
      const queryBuilder = AppDataSource.getRepository(SurveySubmission)
        .createQueryBuilder('submission')
        .leftJoinAndSelect('submission.user', 'user')
        .leftJoinAndSelect('submission.answers', 'answers')
        .leftJoinAndSelect('answers.question', 'question')
        .leftJoinAndSelect('answers.option', 'option')
        .where('submission.survey_id = :surveyId', { surveyId: Number(id) })
        .andWhere('submission.is_deleted = :is_deleted', { is_deleted: 0 })
        .orderBy('submission.created_time', 'DESC');
      
      // 分页
      const total = await queryBuilder.getCount();
      const submissions = await queryBuilder
        .skip((Number(page) - 1) * Number(pageSize))
        .take(Number(pageSize))
        .getMany();
      
      // 格式化返回数据
      const formattedSubmissions = submissions.map(submission => ({
        id: submission._id,
        user: submission.user ? {
          id: submission.user._id,
          name: submission.user.name
        } : null,
        user_name: submission.user_name,
        user_email: submission.user_email,
        user_phone: submission.user_phone,
        ip_address: submission.ip_address,
        status: submission.status,
        answers: submission.answers.map(answer => ({
          question_id: answer.question_id,
          question_text: answer.question.question_text,
          question_type: answer.question.question_type,
          option_id: answer.option_id,
          option_text: answer.option ? answer.option.option_text : null,
          answer_text: answer.answer_text
        })),
        created_time: submission.created_time,
        updated_time: submission.updated_time
      }));
      
      return successResponse(res, {
        submissions: formattedSubmissions,
        total,
        page: Number(page),
        pageSize: Number(pageSize)
      }, '获取提交记录成功');
    } catch (error) {
      logger.error('获取提交记录失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }
}