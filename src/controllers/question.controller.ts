import { Request, Response } from "express";
import { AppDataSource } from "../config/database";
import { Question } from "../models/entities/Question.entity";
import { QuestionOption } from "../models/entities/QuestionOption.entity";
import { logger } from "../utils/logger";
import { errorResponse, successResponse } from "../utils/response";

export class QuestionController {
  // 获取题库列表
  async getList(req: Request, res: Response): Promise<Response> {
    try {
      const { page = 1, pageSize = 20, keyword, question_type, category_id, difficulty } = req.query;
      
      // 构建查询条件
      const queryBuilder = AppDataSource.getRepository(Question)
        .createQueryBuilder("question")
        .leftJoinAndSelect("question.categoryEntity", "category")
        .leftJoinAndSelect("question.creatorEntity", "creator")
        .leftJoinAndSelect("question.options", "options")
        .where("question.status = :status", { status: true });
      
      // 添加筛选条件
      if (keyword) {
        queryBuilder.andWhere("question.content LIKE :keyword", { keyword: `%${keyword}%` });
      }

      if (question_type) {
        queryBuilder.andWhere("question.question_type = :question_type", { question_type });
      }

      if (category_id) {
        queryBuilder.andWhere("question.category_id = :category_id", { category_id });
      }

      if (difficulty) {
        queryBuilder.andWhere("question.difficulty = :difficulty", { difficulty });
      }

      // 计算分页
      const pageNum = Number(page);
      const pageSizeNum = Number(pageSize);
      const skip = (pageNum - 1) * pageSizeNum;
      
      // 获取总数和分页数据
      const [questions, total] = await queryBuilder
        .orderBy("question._id", "DESC")
        .skip(skip)
        .take(pageSizeNum)
        .getManyAndCount();
      
      return successResponse(res, {
        questions,
        total,
        page: pageNum,
        pageSize: pageSizeNum,
        totalPages: Math.ceil(total / pageSizeNum)
      }, "获取题库列表成功");
    } catch (error) {
      logger.error("获取题库列表失败:", error);
      return errorResponse(res, 500, "获取题库列表失败", null);
    }
  }

  // 获取题目详情
  async getDetail(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      
      const question = await AppDataSource.getRepository(Question)
        .createQueryBuilder("question")
        .leftJoinAndSelect("question.categoryEntity", "category")
        .leftJoinAndSelect("question.creatorEntity", "creator")
        .leftJoinAndSelect("question.updaterEntity", "updater")
        .leftJoinAndSelect("question.options", "options")
        .where("question._id = :id", { id })
        .getOne();
      
      if (!question) {
        return errorResponse(res, 404, "题目不存在", null);
      }
      
      return successResponse(res, { question }, "获取题目详情成功");
    } catch (error) {
      logger.error("获取题目详情失败:", error);
      return errorResponse(res, 500, "获取题目详情失败", null);
    }
  }

  // 创建题目
  async create(req: Request, res: Response): Promise<Response> {
    try {
      const {
        category_id,
        training_category,
        question_type,
        content,
        difficulty,
        answer,
        analysis,
        has_image,
        image_path,
        fits_position,
        score,
        source,
        options
      } = req.body;
      
      const userId = (req as any).user?.id;
      
      // 开始事务
      const queryRunner = AppDataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();
      
      try {
        // 创建题目
        const question = new Question();
        question.category_id = category_id;
        question.training_category = training_category;
        question.question_type = question_type;
        question.content = content;
        question.difficulty = difficulty;
        question.answer = answer;
        question.analysis = analysis;
        question.has_image = has_image || false;
        question.image_path = image_path;
        question.fits_position = fits_position;
        question.score = score;
        question.source = source;
        question.creator = userId;
        question.updater = userId;
        
        const savedQuestion = await queryRunner.manager.save(question);
        
        // 创建选项（如果有）
        if (options && Array.isArray(options) && options.length > 0) {
          for (const optionData of options) {
            const option = new QuestionOption();
            option.question_id = savedQuestion._id;
            option.option_label = optionData.option_label;
            option.option_content = optionData.option_content;
            option.is_correct = optionData.is_correct || false;
            
            await queryRunner.manager.save(option);
          }
        }
        
        await queryRunner.commitTransaction();
        
        return successResponse(res, { question: savedQuestion }, "创建题目成功", 201);
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }
    } catch (error) {
      logger.error("创建题目失败:", error);
      return errorResponse(res, 500, "创建题目失败");
    }
  }

  // 更新题目
  async update(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const {
        category_id,
        training_category,
        question_type,
        content,
        difficulty,
        answer,
        analysis,
        has_image,
        image_path,
        fits_position,
        score,
        source,
        status,
        options
      } = req.body;
      
      const userId = (req as any).user?.id;
      
      // 开始事务
      const queryRunner = AppDataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();
      
      try {
        // 检查题目是否存在
        const question = await queryRunner.manager.findOne(Question, {
          where: { _id: Number(id) }
        });
        
        if (!question) {
          await queryRunner.rollbackTransaction();
          return errorResponse(res, 404, "题目不存在");
        }
        
        // 更新题目信息
        question.category_id = category_id;
        question.training_category = training_category;
        question.question_type = question_type;
        question.content = content;
        question.difficulty = difficulty;
        question.answer = answer;
        question.analysis = analysis;
        question.has_image = has_image;
        question.image_path = image_path;
        question.fits_position = fits_position;
        question.score = score;
        question.source = source;
        question.status = status !== undefined ? status : question.status;
        question.updater = userId;
        
        await queryRunner.manager.save(question);
        
        // 更新选项
        if (options && Array.isArray(options)) {
          // 删除原有选项
          await queryRunner.manager.delete(QuestionOption, { question_id: Number(id) });
          
          // 创建新选项
          for (const optionData of options) {
            const option = new QuestionOption();
            option.question_id = Number(id);
            option.option_label = optionData.option_label;
            option.option_content = optionData.option_content;
            option.is_correct = optionData.is_correct || false;
            
            await queryRunner.manager.save(option);
          }
        }
        
        await queryRunner.commitTransaction();
        
        return successResponse(res, { question }, "更新题目成功");
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }
    } catch (error) {
      logger.error("更新题目失败:", error);
      return errorResponse(res, 500, "更新题目失败");
    }
  }

  // 删除题目
  async delete(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      
      const question = await AppDataSource.getRepository(Question).findOne({
        where: { _id: Number(id) }
      });
      
      if (!question) {
        return errorResponse(res, 404, "题目不存在");
      }
      
      // 软删除：设置状态为禁用
      question.status = false;
      await AppDataSource.getRepository(Question).save(question);
      
      return successResponse(res, null, "删除题目成功");
    } catch (error) {
      logger.error("删除题目失败:", error);
      return errorResponse(res, 500, "删除题目失败");
    }
  }

  // 批量删除题目
  async batchDelete(req: Request, res: Response): Promise<Response> {
    try {
      const { ids } = req.body;
      
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return errorResponse(res, 400, "请提供要删除的题目ID列表");
      }
      
      await AppDataSource.getRepository(Question)
        .createQueryBuilder()
        .update(Question)
        .set({ status: false })
        .where("_id IN (:...ids)", { ids })
        .execute();
      
      return successResponse(res, null, "批量删除题目成功");
    } catch (error) {
      logger.error("批量删除题目失败:", error);
      return errorResponse(res, 500, "批量删除题目失败");
    }
  }

  // 批量导入题目
  async import(req: Request, res: Response): Promise<Response> {
    try {
      const { questions } = req.body;
      
      if (!questions || !Array.isArray(questions) || questions.length === 0) {
        return errorResponse(res, 400, "请提供要导入的题目数据");
      }
      
      const results = {
        success: 0,
        updated: 0,
        ignored: 0,
        failed: 0,
        errors: [] as string[]
      };
      
      const questionRepository = AppDataSource.getRepository(Question);
      const optionRepository = AppDataSource.getRepository(QuestionOption);
      
      for (let i = 0; i < questions.length; i++) {
        const questionData = questions[i];
        
        try {
          // 验证必填字段
          if (!questionData.content || !questionData.question_type) {
            results.failed++;
            results.errors.push(`第${i + 1}行：题目内容和题目类型为必填项`);
            continue;
          }
          
          // 检查是否已存在相同题目
          const existingQuestion = await questionRepository.findOne({
            where: { content: questionData.content }
          });
          
          let question: Question;
          
          if (existingQuestion) {
            // 更新现有题目
            Object.assign(existingQuestion, {
              question_type: questionData.question_type,
              difficulty: questionData.difficulty || 1,
              score: questionData.score || 1,
              category_id: questionData.category_id || null,
              creator_id: questionData.creator_id || null,
              updated_at: new Date()
            });
            
            question = await questionRepository.save(existingQuestion);
            results.updated++;
          } else {
            // 创建新题目
            question = new Question();
            Object.assign(question, {
              content: questionData.content,
              question_type: questionData.question_type,
              difficulty: questionData.difficulty || 1,
              score: questionData.score || 1,
              category_id: questionData.category_id || null,
              creator_id: questionData.creator_id || null,
              status: true,
              created_at: new Date(),
              updated_at: new Date()
            });
            
            question = await questionRepository.save(question);
            results.success++;
          }
          
          // 处理选项（如果有）
          if (questionData.options && Array.isArray(questionData.options)) {
            // 删除现有选项
            await optionRepository.delete({ question_id: question._id });
            
            // 创建新选项
            for (const optionData of questionData.options) {
              console.log(optionData);
              const option = new QuestionOption();
              Object.assign(option, {
                question_id: question._id,
                option_label: optionData.option_label,
                option_content: optionData.option_content,
                is_correct: optionData.is_correct || false
              });
              
              await optionRepository.save(option);
            }
          }
          
        } catch (error) {
          results.failed++;
          results.errors.push(`第${i + 1}行：${error}`);
          logger.error(`导入第${i + 1}行题目失败:`, error);
        }
      }
      
      return successResponse(res, results, "批量导入完成");
    } catch (error) {
      logger.error("批量导入题目失败:", error);
      return errorResponse(res, 500, "批量导入题目失败");
    }
  }
}