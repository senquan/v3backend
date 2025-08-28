import { Request, Response } from "express";
import { AppDataSource } from "../config/database";
import { Exam } from "../models/entities/Exam.entity";
import { ExamQuestion } from "../models/entities/ExamQuestion.entity";
import { Question } from "../models/entities/Question.entity";
import { ExamRecord } from "../models/entities/ExamRecord.entity";
import { StudyExamRecord } from "../models/entities/StudyExamRecord.entity";
import { StudyPlan } from "../models/entities/StudyPlan.entity";
import { TrainingRecord } from "../models/entities/TrainingRecord.entity";
import { TrainingRecordParticipant } from "../models/entities/TrainingRecordParticipant.entity";
import { logger } from "../utils/logger";
import { errorResponse, successResponse } from "../utils/response";
import { ExamAnswer } from "../models/entities/ExamAnswer.entity";

// 考试设置参数接口
interface ExamSettings {
  totalScore: number;           // 总分
  examCategory: number;         // 考试分类
  level: number;               // 级别
  knowledgeCoverage: number;   // 知识点覆盖率 (0-100)
  difficulty: number;          // 难易度 (1-5)
  fairnessIndex: number;       // 公平性指标 (0-100)
  questionCount: number;       // 题目数量
  questionTypes?: string[];    // 题目类型限制
  categoryIds?: number[];      // 分类限制
}

// 题目元数据扩展接口
interface QuestionMetadata {
  knowledgeCode?: string;      // 知识点编码
  weight?: number;             // 权重
  tags?: string[];             // 标签
  usageCount?: number;         // 使用次数
  correctRate?: number;        // 正确率
  timeSpent?: number;          // 平均用时
}

// 智能出题算法配置
interface SmartSelectionConfig {
  difficultyDistribution: { [key: number]: number }; // 难度分布
  typeDistribution: { [key: string]: number };       // 题型分布
  categoryDistribution: { [key: number]: number };   // 分类分布
  avoidRecentUsed: boolean;                          // 避免最近使用的题目
  balanceKnowledge: boolean;                         // 平衡知识点覆盖
}

export class ExamController {
  // 预设的考试设置参数
  private getDefaultExamSettings(): ExamSettings {
    return {
      totalScore: 100,
      examCategory: 101,
      level: 3,
      knowledgeCoverage: 80,
      difficulty: 3,
      fairnessIndex: 85,
      questionCount: 50,
      questionTypes: ['单选', '多选', '判断'],
      categoryIds: []
    };
  }

  // 预设的智能选题配置
  private getDefaultSelectionConfig(): SmartSelectionConfig {
    return {
      difficultyDistribution: {
        1: 0.1,  // 10% 简单题
        2: 0.2,  // 20% 较简单题
        3: 0.4,  // 40% 中等题
        4: 0.2,  // 20% 较难题
        5: 0.1   // 10% 困难题
      },
      typeDistribution: {
        '单选题': 0.5,
        '多选题': 0.3,
        '判断题': 0.2
      },
      categoryDistribution: {},
      avoidRecentUsed: true,
      balanceKnowledge: true
    };
  }

  async generateExamByRecord(req: Request, res: Response): Promise<Response> {

    const recordId = req.params.id;
    req.body.recordId = recordId;
    const { settings } = req.body;

    // 查找培训记录
    const trainingRecord = await AppDataSource.getRepository(TrainingRecord).findOne({
      where: { id: Number(recordId) },
      relations: ['training_plan']
    });
    if (!trainingRecord) {
      return errorResponse(res, 400, "培训记录不存在");
    }
    req.body.title = trainingRecord.training_plan.name + "考试";
    req.body.description = "培训记录编号：" + trainingRecord.id;
    req.body.trainingCategory = trainingRecord.training_plan.training_category;

    if (!settings) {
      req.body.settings = this.getDefaultExamSettings();
    }
    req.body.settings.examCategory = 101;
    
    const response = await this.generateExam(req, res);
    if (response.statusCode === 200) {
      trainingRecord.exam_status = 1;
      await AppDataSource.getRepository(TrainingRecord).save(trainingRecord);
    }
    
    return response;
  }

  async generateExamByStudyPlan(req: Request, res: Response): Promise<Response> {

    const planId = req.params.id;
    req.body.recordId = planId;
    const { settings } = req.body;

    // 查找学习计划记录
    const planRecord = await AppDataSource.getRepository(StudyPlan).findOne({
      where: { id: Number(planId) }
    });
    if (!planRecord) {
      return errorResponse(res, 400, "学习计划记录不存在");
    }
    req.body.title = planRecord.title + "考试";
    req.body.description = "学习计划编号：" + planRecord.id;
    req.body.trainingCategory = planRecord.category;

    if (!settings) {
      req.body.settings = this.getDefaultExamSettings();
    }
    req.body.settings.examCategory = 101;
    
    const response = await this.generateExam(req, res);
    if (response.statusCode === 200) {
      planRecord.status = 1;
      await AppDataSource.getRepository(StudyPlan).save(planRecord);
    }
    
    return response;
  }

  // 自动生成考卷
  async generateExam(req: Request, res: Response): Promise<Response> {
    try {
      const {
        recordId,
        title,
        description,
        trainingCategory,
        examType = 1,
        settings = this.getDefaultExamSettings(),
        selectionConfig = this.getDefaultSelectionConfig()
      } = req.body;

      const userId = (req as any).user?._id;

      // 开始事务
      const queryRunner = AppDataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        // 1. 创建考试记录
        const exam = new Exam();
        exam.title = title;
        exam.description = description;
        exam.type = examType;
        exam.category_id = settings.examCategory;
        exam.training_category = trainingCategory;
        exam.level = settings.level;
        exam.question_count = settings.questionCount;
        exam.total_score = settings.totalScore;
        exam.pass_score = settings.passScore || Math.floor(settings.totalScore * 0.6); // 默认60%及格
        exam.duration = settings.duration || 120; // 默认120分钟
        exam.status = false;
        exam.creator = userId;
        exam.updater = userId;

        const savedExam = await queryRunner.manager.save(exam);

        // 2. 智能选题
        const selectedQuestions = await this.smartSelectQuestions(
          settings,
          selectionConfig,
          queryRunner
        );

        if (selectedQuestions.length === 0) {
          await queryRunner.rollbackTransaction();
          return errorResponse(res, 400, "没有找到符合条件的题目");
        }

        // 3. 创建考试题目关联
        let order = 1;
        for (const question of selectedQuestions) {
          const examQuestion = new ExamQuestion();
          examQuestion.exam_id = savedExam._id;
          examQuestion.question_id = question._id;
          examQuestion.question_score = question.score || Math.floor(settings.totalScore / settings.questionCount);
          examQuestion.question_order = order++;

          await queryRunner.manager.save(examQuestion);
        }

        // 4. 生成考生考试记录
        if (recordId) {
          if (examType === 2) {
            await this.generateMockExamRecord(queryRunner, recordId, savedExam);
          } else {
            await this.generateExamRecord(queryRunner, recordId, savedExam._id);
          }
        }

        // 5. 获取生成的考卷信息（在事务提交前）
        const examWithQuestions = await this.getExamWithQuestionsInTransaction(queryRunner, savedExam._id);

        await queryRunner.commitTransaction();
        
        // 6. 准备返回数据
        const responseData = {
          exam: examWithQuestions,
          statistics: {
            totalQuestions: selectedQuestions.length,
            difficultyDistribution: this.calculateDifficultyDistribution(selectedQuestions),
            typeDistribution: this.calculateTypeDistribution(selectedQuestions),
            categoryDistribution: this.calculateCategoryDistribution(selectedQuestions)
          }
        };
        
        return successResponse(res, responseData, "考卷生成成功");

      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }
    } catch (error) {
      logger.error("生成考卷失败:", error);
      return errorResponse(res, 500, "生成考卷失败");
    }
  }

  // 生成考试记录
  private async generateExamRecord(
    queryRunner: any,
    recordId: number,
    examId: number
  ): Promise<void> {
    try {
      const queryBuilder = queryRunner.manager
        .createQueryBuilder(TrainingRecordParticipant, "participant")
        .where("participant.training_record_id = :recordId", { recordId });
      const participants = await queryBuilder.getMany();

      const examRecords = await queryRunner.manager.createQueryBuilder(ExamRecord, "exam")
        .where("exam.training_record_id = :recordId", { recordId }).getMany();

      // 对于每个参与考试的人员，如果没有考试记录，创建
      for (const participant of participants) {
        if (examRecords.some((record: ExamRecord) => record.participant_id === participant.id)) continue;
        const examRecord = new ExamRecord();
        examRecord.training_record_id = recordId;
        examRecord.exam_id = examId;
        examRecord.participant_id = participant.id;
        await queryRunner.manager.save(examRecord);
      }
    } catch (error) {
      logger.error("生成考试记录失败:", error);
    }
  }

  private async generateMockExamRecord(
    queryRunner: any,
    recordId: number,
    exam: Exam
  ): Promise<void> {
    try {
      const examRecord = new StudyExamRecord();
        examRecord.study_plan_id = recordId;
        examRecord.exam_id = exam._id;
        examRecord.user_id = exam.creator || 0;
        examRecord.total_score = exam.total_score;
        await queryRunner.manager.save(examRecord);
    } catch (error) {
      logger.error("生成考试记录失败:", error);
    }
  }

  // 智能选题算法
  private async smartSelectQuestions(
    settings: ExamSettings,
    config: SmartSelectionConfig,
    queryRunner: any
  ): Promise<Question[]> {
    try {
      const questionTypesMap = {
        single_choice: "单选",
        multiple_choice: "多选",
        true_false: "判断",
        fill_blank: "填空",
        short_answer: "简答"
      }

      // 1. 构建基础查询
      let queryBuilder = queryRunner.manager
        .createQueryBuilder(Question, "question")
        .leftJoinAndSelect("question.options", "options")
        .where("question.status = :status", { status: true });

      // 2. 应用筛选条件
      if (settings.questionTypes && settings.questionTypes.length > 0) {
        queryBuilder.andWhere("question.question_type IN (:...types)", {
          types: settings.questionTypes.map(type => questionTypesMap[type as keyof typeof questionTypesMap])
        });
      }

      if (settings.categoryIds && settings.categoryIds.length > 0) {
        queryBuilder.andWhere("question.category_id IN (:...categoryIds)", {
          categoryIds: settings.categoryIds
        });
      }

      // 3. 获取候选题目池
      const candidateQuestions = await queryBuilder.getMany();

      if (candidateQuestions.length === 0) {
        return [];
      }

      // 4. 智能筛选算法
      const selectedQuestions: Question[] = [];
      const usedQuestions = new Set<number>();

      // 按难度分布选题
      for (const [difficulty, ratio] of Object.entries(config.difficultyDistribution)) {
        const targetCount = Math.floor(settings.questionCount * ratio);
        const difficultyQuestions = candidateQuestions.filter(
          (q: Question) => q.difficulty === Number(difficulty) && !usedQuestions.has(q._id)
        );

        // 随机选择指定数量的题目
        const shuffled = this.shuffleArray([...difficultyQuestions]);
        const selected = shuffled.slice(0, targetCount);

        selected.forEach(q => {
          selectedQuestions.push(q);
          usedQuestions.add(q._id);
        });
      }

      // 5. 如果题目不够，补充选择
      if (selectedQuestions.length < settings.questionCount) {
        const remaining = candidateQuestions.filter(
          (q: Question) => !usedQuestions.has(q._id)
        );
        const shuffled = this.shuffleArray(remaining);
        const needed = settings.questionCount - selectedQuestions.length;
        const additional = shuffled.slice(0, needed) as Question[];
        selectedQuestions.push(...additional);
      }

      // 6. 最终随机排序
      return this.shuffleArray(selectedQuestions).slice(0, settings.questionCount);

    } catch (error) {
      logger.error("智能选题失败:", error);
      return [];
    }
  }

  // 获取考试详情（包含题目）- 在事务中执行
  private async getExamWithQuestionsInTransaction(queryRunner: any, examId: number): Promise<any> {
    return await queryRunner.manager
      .createQueryBuilder(Exam, "exam")
      .leftJoinAndSelect("exam.examQuestions", "examQuestion")
      .leftJoinAndSelect("examQuestion.questionEntity", "question")
      .leftJoinAndSelect("question.options", "options")
      .where("exam._id = :examId", { examId })
      .orderBy("examQuestion.question_order", "ASC")
      .getOne();
  }

  // 获取考试详情（包含题目）
  private async getExamWithQuestions(examId: number): Promise<any> {
    return await AppDataSource.getRepository(Exam)
      .createQueryBuilder("exam")
      .leftJoinAndSelect("exam.examQuestions", "examQuestion")
      .leftJoinAndSelect("examQuestion.questionEntity", "question")
      .leftJoinAndSelect("question.options", "options")
      .where("exam._id = :examId", { examId })
      .orderBy("examQuestion.question_order", "ASC")
      .getOne();
  }

  // 计算难度分布
  private calculateDifficultyDistribution(questions: Question[]): { [key: number]: number } {
    const distribution: { [key: number]: number } = {};
    questions.forEach(q => {
      const difficulty = q.difficulty || 3;
      distribution[difficulty] = (distribution[difficulty] || 0) + 1;
    });
    return distribution;
  }

  // 计算题型分布
  private calculateTypeDistribution(questions: Question[]): { [key: string]: number } {
    const distribution: { [key: string]: number } = {};
    questions.forEach(q => {
      distribution[q.question_type] = (distribution[q.question_type] || 0) + 1;
    });
    return distribution;
  }

  // 计算分类分布
  private calculateCategoryDistribution(questions: Question[]): { [key: number]: number } {
    const distribution: { [key: number]: number } = {};
    questions.forEach(q => {
      const categoryId = q.category_id || 0;
      distribution[categoryId] = (distribution[categoryId] || 0) + 1;
    });
    return distribution;
  }

  // 数组随机排序
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  // 获取考试列表
  async getList(req: Request, res: Response): Promise<Response> {
    try {
      const { page = 1, pageSize = 20, keyword, type, category_id, level } = req.query;
      const userId = (req as any).user?._id;
      const examType = type ? 1 : type;

      const queryBuilder = AppDataSource.getRepository(Exam)
        .createQueryBuilder("exam")
        .leftJoinAndSelect("exam.creatorEntity", "creator")
        .where("exam.status != :status", { status: 0 })
        .andWhere("exam.type = :type", { type: examType });

      // 添加筛选条件
      if (keyword) {
        queryBuilder.andWhere("exam.title LIKE :keyword", { keyword: `%${keyword}%` });
      }

      if (category_id) {
        queryBuilder.andWhere("exam.category_id = :category_id", { category_id });
      }

      if (level) {
        queryBuilder.andWhere("exam.level = :level", { level });
      }

      // 计算分页
      const pageNum = Number(page);
      const pageSizeNum = Number(pageSize);
      const skip = (pageNum - 1) * pageSizeNum;

      const [exams, total] = await queryBuilder
        .orderBy("exam._id", "DESC")
        .skip(skip)
        .take(pageSizeNum)
        .getManyAndCount();

      return successResponse(res, {
        exams,
        total,
        page: pageNum,
        pageSize: pageSizeNum,
        totalPages: Math.ceil(total / pageSizeNum)
      }, "获取考试列表成功");
    } catch (error) {
      logger.error("获取考试列表失败:", error);
      return errorResponse(res, 500, "获取考试列表失败");
    }
  }

  async getMyList(req: Request, res: Response): Promise<Response> {
    try {
      const userId = (req as any).user?._id || 1393;
      const { page = 1, pageSize = 20 } = req.query;

      const queryBuilder = AppDataSource.getRepository(ExamRecord)
        .createQueryBuilder("record")
        .leftJoinAndSelect("record.participant", "participant")
        .leftJoinAndSelect("record.examEntity", "exam")
        .leftJoinAndSelect("exam.examQuestions", "examQuestion")
        .where("exam.status = :status", { status: true });

      if (userId) {
        queryBuilder.andWhere("participant.user_id = :userId", { userId });
      }

      // 计算分页
      const pageNum = Number(page);
      const pageSizeNum = Number(pageSize);
      const skip = (pageNum - 1) * pageSizeNum;

      const [exams, total] = await queryBuilder
        .orderBy("record._id", "DESC")
        .skip(skip)
        .take(pageSizeNum)
        .getManyAndCount();

      return successResponse(res, {
        exams,
        total,
        page: pageNum,
        pageSize: pageSizeNum,
        totalPages: Math.ceil(total / pageSizeNum)
      }, "获取考试列表成功");
    } catch (error) {
      logger.error("获取考试列表失败:", error);
      return errorResponse(res, 500, "获取考试列表失败");
    }
  }

  // 获取考试详情
  async getDetail(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;

      const exam = await this.getExamWithQuestions(Number(id));

      if (!exam) {
        return errorResponse(res, 404, "考试不存在");
      }

      return successResponse(res, { exam }, "获取考试详情成功");
    } catch (error) {
      logger.error("获取考试详情失败:", error);
      return errorResponse(res, 500, "获取考试详情失败");
    }
  }

  // 更新考试设置
  async updateSettings(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { settings } = req.body;
      const userId = (req as any).user?._id;

      const exam = await AppDataSource.getRepository(Exam).findOne({
        where: { _id: Number(id) }
      });

      if (!exam) {
        return errorResponse(res, 404, "考试不存在");
      }

      // 更新考试设置
      if (settings.totalScore) exam.total_score = settings.totalScore;
      if (settings.level) exam.level = settings.level;
      if (settings.examCategory) exam.category_id = settings.examCategory;
      exam.updater = userId;

      await AppDataSource.getRepository(Exam).save(exam);

      return successResponse(res, { exam }, "更新考试设置成功");
    } catch (error) {
      logger.error("更新考试设置失败:", error);
      return errorResponse(res, 500, "更新考试设置失败");
    }
  }

  // 重新生成考卷
  async regenerateExam(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { settings, selectionConfig } = req.body;
      const userId = (req as any).user?._id;

      const exam = await AppDataSource.getRepository(Exam).findOne({
        where: { _id: Number(id) }
      });

      if (!exam) {
        return errorResponse(res, 404, "考试不存在");
      }

      // 开始事务
      const queryRunner = AppDataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        // 1. 删除原有题目关联
        await queryRunner.manager.delete(ExamQuestion, { exam_id: exam._id });

        // 2. 重新智能选题
        const newSettings = { ...this.getDefaultExamSettings(), ...settings };
        const newConfig = { ...this.getDefaultSelectionConfig(), ...selectionConfig };
        
        console.log("settings", settings);
        const selectedQuestions = await this.smartSelectQuestions(
          newSettings,
          newConfig,
          queryRunner
        );

        if (selectedQuestions.length === 0) {
          await queryRunner.rollbackTransaction();
          return errorResponse(res, 400, "没有找到符合条件的题目");
        }

        // 3. 创建新的题目关联
        let order = 1;
        for (const question of selectedQuestions) {
          const examQuestion = new ExamQuestion();
          examQuestion.exam_id = exam._id;
          examQuestion.question_id = question._id;
          examQuestion.question_score = question.score || Math.floor(newSettings.totalScore / newSettings.questionCount);
          examQuestion.question_order = order++;

          await queryRunner.manager.save(examQuestion);
        }

        // 4. 更新考试设置
        exam.total_score = newSettings.totalScore;
        exam.pass_score = newSettings.passScore || Math.floor(newSettings.totalScore * 0.6); // 默认60%及格
        exam.duration = newSettings.duration || 120; // 默认120分钟
        exam.updater = userId;

        await queryRunner.manager.save(exam);

        await queryRunner.commitTransaction();

        // 4. 返回更新后的考卷
        const updatedExam = await this.getExamWithQuestions(exam._id);

        return successResponse(res, {
          exam: updatedExam,
          statistics: {
            totalQuestions: selectedQuestions.length,
            difficultyDistribution: this.calculateDifficultyDistribution(selectedQuestions),
            typeDistribution: this.calculateTypeDistribution(selectedQuestions),
            categoryDistribution: this.calculateCategoryDistribution(selectedQuestions)
          }
        }, "考卷重新生成成功");

      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }
    } catch (error) {
      logger.error("重新生成考卷失败:", error);
      return errorResponse(res, 500, "重新生成考卷失败");
    }
  }

  // 提交考卷
  async submitExam(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { answers } = req.body;
      const userId = (req as any).user?._id;

      // 开始事务
      const queryRunner = AppDataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        // 获取考试信息
        const exam = await queryRunner.manager
          .createQueryBuilder(Exam, "exam")
          .leftJoinAndSelect("exam.examQuestions", "examQuestion")
          .leftJoinAndSelect("examQuestion.questionEntity", "question")
          .leftJoinAndSelect("question.options", "options")
          .where("exam._id = :examId", { examId: Number(id) })
          .getOne();

        if (!exam) {
          await queryRunner.rollbackTransaction();
          return errorResponse(res, 404, "考试不存在");
        }

        // 检查答案是否完整
        if (!answers || answers.length === 0) {
          await queryRunner.rollbackTransaction();
          return errorResponse(res, 400, "答案不能为空");
        }

        // 获取或创建考试记录
        let examRecord = await queryRunner.manager
          .createQueryBuilder(ExamRecord, "record")
          .where("record.exam_id = :examId", { examId: exam._id })
          .andWhere("record.participant_id IN (SELECT p.id FROM training.tr_training_record_participants p WHERE p.user_id = :userId)", { userId })
          .getOne();

        if (!examRecord) {
          // 查找参与者ID
          const participant = await queryRunner.manager
            .createQueryBuilder(TrainingRecordParticipant, "participant")
            .where("participant.user_id = :userId", { userId })
            .andWhere("participant.training_record_id = (SELECT r.training_record_id FROM training.tr_exam_records r WHERE r.exam_id = :examId LIMIT 1)", { examId: exam._id })
            .getOne();

          if (!participant) {
            await queryRunner.rollbackTransaction();
            return errorResponse(res, 403, "您不是该考试的参与者");
          }

          // 创建新的考试记录
          examRecord = new ExamRecord();
          examRecord.exam_id = exam._id;
          examRecord.participant_id = participant.id;
          examRecord.training_record_id = participant.training_record_id;
          examRecord.start_time = new Date();
          examRecord = await queryRunner.manager.save(examRecord);
        }

        // 设置结束时间
        examRecord.end_time = new Date();

        // 计算得分
        let totalScore = 0;
        let correctCount = 0;

        // 删除之前的答案记录（如果有）
        await queryRunner.manager
          .createQueryBuilder()
          .delete()
          .from(ExamAnswer)
          .where("exam_record_id = :recordId", { recordId: examRecord._id })
          .execute();

        // 保存新的答案并计算得分
        for (const answer of answers) {
          const { questionId, userAnswer } = answer;
          
          // 查找题目和分数
          const examQuestion = exam.examQuestions.find(eq => eq.question_id === questionId);
          if (!examQuestion) continue;
          
          const question = examQuestion.questionEntity;
          const questionScore = examQuestion.question_score || 0;
          
          // 判断答案是否正确
          let isCorrect = false;
          let score = 0;
          
          if (question.question_type === '判断' || question.question_type === '单选') {
            // 单选题比较选项
            const correctOption = question.options.find(opt => opt.is_correct);
            if (question.question_type === '判断') {
              isCorrect = correctOption ? userAnswer === correctOption.option_content : false;
            } else {
              isCorrect = correctOption ? userAnswer === correctOption.option_label : false;
            }
            score = isCorrect ? questionScore : 0;
          } else if (question.question_type === '多选') {
            // 多选题比较选项集合
            const userAnswers = userAnswer.split(',').map((a: any) => a.trim()).sort();
            const correctOptions = question.options
              .filter(opt => opt.is_correct)
              .map(opt => opt.option_label)
              .sort();
            
            // 完全匹配才得满分，部分匹配得部分分
            const correctAnswers = JSON.stringify(userAnswers) === JSON.stringify(correctOptions);
            if (correctAnswers) {
              isCorrect = true;
              score = questionScore;
            } else {
              // 部分正确给一半分数
              const correctCount = userAnswers.filter((a: any) => correctOptions.includes(a)).length;
              const incorrectCount = userAnswers.filter((a: any) => !correctOptions.includes(a)).length;
              
              if (correctCount > 0 && incorrectCount === 0 && correctCount < correctOptions.length) {
                score = Math.floor(questionScore * 0.5);
                isCorrect = false;
              } else {
                score = 0;
                isCorrect = false;
              }
            }
          } else if (question.question_type === '填空') {
            // 填空题比较关键词
            const standardAnswers = question.answer?.split('|') || [];
            isCorrect = standardAnswers.some(ans => 
              userAnswer.toLowerCase().trim() === ans.toLowerCase().trim()
            );
            score = isCorrect ? questionScore : 0;
          } else if (question.question_type === '简答') {
            // 简答题需要人工评分，先设为0分
            isCorrect = false;
            score = 0;
          }
          
          // 保存答案记录
          const examAnswer = new ExamAnswer();
          examAnswer.exam_record_id = examRecord._id;
          examAnswer.question_id = questionId;
          examAnswer.user_answer = userAnswer;
          examAnswer.is_correct = isCorrect;
          examAnswer.score = score;
          
          await queryRunner.manager.save(examAnswer);
          
          // 累计得分
          if (isCorrect) correctCount++;
          totalScore += Number(score);
        }
        
        // 更新考试记录的得分
        examRecord.score = totalScore;
        examRecord.is_passed = totalScore >= exam.pass_score;
        await queryRunner.manager.save(examRecord);
        
        await queryRunner.commitTransaction();
        
        return successResponse(res, {
          examId: exam._id,
          recordId: examRecord._id,
          totalScore,
          correctCount,
          totalCount: exam.examQuestions.length,
          isPassed: examRecord.is_passed
        }, "提交成功");

      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }
    } catch (error) {
      logger.error("提交考卷失败:", error);
      return errorResponse(res, 500, "提交考卷失败");
    }
  }

  // 获取考试结果
  async getResult(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?._id;

      // 获取考试信息
      const exam = await AppDataSource.getRepository(Exam)
        .createQueryBuilder("exam")
        .leftJoinAndSelect("exam.examQuestions", "examQuestion")
        .leftJoinAndSelect("examQuestion.questionEntity", "question")
        .leftJoinAndSelect("question.options", "options")
        .where("exam._id = :examId", { examId: Number(id) })
        .getOne();

      if (!exam) {
        return errorResponse(res, 404, "考试不存在");
      }

      // 获取用户的考试记录
      const examRecord = await AppDataSource.getRepository(ExamRecord)
        .createQueryBuilder("record")
        .leftJoinAndSelect("record.participant", "participant")
        .where("record.exam_id = :examId", { examId: exam._id })
        .andWhere("participant.user_id = :userId", { userId })
        .getOne();

      if (!examRecord) {
        return errorResponse(res, 404, "未找到您的考试记录");
      }

      // 获取用户的答案
      const examAnswers = await AppDataSource.getRepository(ExamAnswer)
        .createQueryBuilder("answer")
        .leftJoinAndSelect("answer.questionEntity", "question")
        .leftJoinAndSelect("question.options", "options")
        .where("answer.exam_record_id = :recordId", { recordId: examRecord._id })
        .getMany();

      // 整理考试结果数据
      const questionResults = exam.examQuestions.map(examQuestion => {
        const question = examQuestion.questionEntity;
        const userAnswer = examAnswers.find(a => a.question_id === question._id);
        
        // 获取正确答案
        let correctAnswer = '';
        if (question.question_type === '判断') {
          correctAnswer = question.answer || '';
        } else if (['单选', '多选'].includes(question.question_type)) {
          correctAnswer = question.options
            .filter(opt => opt.is_correct)
            .map(opt => opt.option_label)
            .join(', ');
        } else {
          correctAnswer = question.answer || '';
        }
        
        return {
          questionId: question._id,
          questionType: question.question_type,
          content: question.content,
          options: question.options,
          correctAnswer,
          userAnswer: userAnswer?.user_answer || '',
          isCorrect: userAnswer?.is_correct,
          score: userAnswer?.score || 0,
          maxScore: examQuestion.question_score,
          analysis: question.analysis
        };
      });

      // 计算统计数据
      const totalQuestions = questionResults.length;
      const correctCount = questionResults.filter(q => q.isCorrect === true).length;
      const incorrectCount = questionResults.filter(q => q.isCorrect === false).length;
      const pendingCount = questionResults.filter(q => q.isCorrect === null).length;
      
      // 按题型分类统计
      const typeStats = {} as Record<string, any>;
      questionResults.forEach(q => {
        if (!typeStats[q.questionType]) {
          typeStats[q.questionType] = {
            total: 0,
            correct: 0,
            incorrect: 0,
            pending: 0,
            score: 0,
            maxScore: 0
          };
        }
        
        typeStats[q.questionType].total += 1;
        typeStats[q.questionType].maxScore += q.maxScore;
        typeStats[q.questionType].score += q.score;
        
        if (q.isCorrect === true) typeStats[q.questionType].correct += 1;
        else if (q.isCorrect === false) typeStats[q.questionType].incorrect += 1;
        else typeStats[q.questionType].pending += 1;
      });

      return successResponse(res, {
        exam,
        examRecord,
        questions: questionResults,
        statistics: {
          totalQuestions,
          correctCount,
          incorrectCount,
          pendingCount,
          score: examRecord.score,
          maxScore: exam.total_score,
          isPassed: examRecord.is_passed,
          passScore: exam.pass_score,
          typeStats
        }
      }, "获取考试结果成功");

    } catch (error) {
      logger.error("获取考试结果失败:", error);
      return errorResponse(res, 500, "获取考试结果失败");
    }
  }

  // 发布试卷
  async publishExam(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const exam = await AppDataSource.getRepository(Exam).findOneBy({ _id: Number(id) });
      if (!exam) {
        return errorResponse(res, 404, "考试不存在");
      }
      exam.status = true;
      await AppDataSource.getRepository(Exam).save(exam);
      return successResponse(res, exam, "发布成功");
    } catch (error) {
      logger.error("发布试卷失败:", error);
      return errorResponse(res, 500, "发布试卷失败");
    }
  }

  // 上报成绩
  async reportScore(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { paper_path, score } = req.body;

      const examRecord = await AppDataSource.getRepository(ExamRecord).findOne({
        where: { _id: Number(id) },
        relations: ["examEntity"]
      });
      
      if (!examRecord) {
        return errorResponse(res, 404, "考试记录不存在");
      }
      
      examRecord.score = score;
      if (paper_path && paper_path.length > 0) {
        examRecord.offline_paper = JSON.stringify(paper_path);
      }
      
      // 添加空值检查
      if (examRecord.examEntity && examRecord.examEntity.pass_score) {
        examRecord.is_passed = score >= examRecord.examEntity.pass_score;
      } else {
        const defaultPassScore = 60; // 可以根据业务需求设置默认通过分数
        examRecord.is_passed = score >= defaultPassScore;
      }
      
      await AppDataSource.getRepository(ExamRecord).save(examRecord);
      return successResponse(res, examRecord, "上报成绩成功");
    } catch (error) {
      logger.error("上报成绩失败:", error);
      return errorResponse(res, 500, "上报成绩失败");
    }
  }
}