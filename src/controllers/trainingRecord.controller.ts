import { Request, Response } from 'express';
import { In, Not } from 'typeorm';
import { parseTime } from '../utils';
import { AppDataSource } from '../config/database';
import { Certificate } from '../models/entities/Certificate.entity';
import { errorResponse, successResponse } from '../utils/response';
import { Material } from '../models/entities/Material.entity';
import { TrainingPlanScope } from '../models/entities/TrainingPlanScope.entity';
import { TrainingRecord } from '../models/entities/TrainingRecord.entity';
import { TrainingRecordParticipant } from '../models/entities/TrainingRecordParticipant.entity';
import { TrainingRecordCourseware } from '../models/entities/TrainingRecordCourseware.entity';
import { TrainingRecordContent } from '../models/entities/TrainingRecordContent.entity';
import { TrainingPlan } from '../models/entities/TrainingPlan.entity';
import { Branch } from '../models/entities/Branch.entity';
import { User } from '../models/entities/User.entity';
import { TaskAssignment } from '../models/entities/TaskAssignment.entity';
import { ConstructionWorker } from '../models/entities/ConstructionWorker.entity';
import { ExamRecord } from '../models/entities/ExamRecord.entity';

export interface MyTask {
    id: number;
    type: number;
    title: string;
    description: string | null;
    trainer: string;
    progress: number;
    duration: number;
    result: boolean;
    assessmentMethod: number;
}

export class TrainingRecordController {
  
    async getList(req: Request, res: Response): Promise<Response> {
        try {
            const { page = 1, pageSize = 20, keyword, branch, sort } = req.query;
            const branchId = Number(branch);
            
            // 构建查询条件
            const queryBuilder = AppDataSource.getRepository(TrainingRecord)
              .createQueryBuilder('record')
              .leftJoinAndSelect('record.training_plan', 'plan')
              .where('plan.is_deleted = :is_deleted', { is_deleted: 0 });
            
            // 添加筛选条件
            if (keyword) {
              queryBuilder.andWhere('(plan.name LIKE :keyword OR record.remarks LIKE :keyword)', { keyword: `%${keyword}%` });
            }
      
            // 添加排序
            if (sort) {
              const order = String(sort).substring(0, 1);
              const field = String(sort).substring(1);
              if (field && order) {
                queryBuilder.orderBy(`record.${field}`, order === "+" ? "ASC" : "DESC");
              }
            } else {
              queryBuilder.orderBy('record.id', 'ASC');
            }

            if (branchId > 0) {
                const subQueryBuilder = AppDataSource.getRepository(TrainingPlanScope)
                 .createQueryBuilder('scope')
                 .where('scope.branch_id = :branch_id')
                 .select('scope.training_plan_id');
                queryBuilder.andWhere('record.training_plan_id IN (' + subQueryBuilder.getQuery() + ')')
                 .setParameter('branch_id', branchId);
            }
      
            // 分页
            const total = await queryBuilder.getCount();
            const records = await queryBuilder
              .skip((Number(page) - 1) * Number(pageSize))
              .take(Number(pageSize))
              .getMany();
      
            // 格式化返回数据
            const formattedStatistics = records.map(record => ({
              id: record.id,
              name: record.training_plan.name,
              actual_time: record.actual_time,
              trainer: record.training_plan.trainer,
              training_mode: record.training_plan.training_mode,
              training_category: record.training_plan.training_category,
              planned_participants: record.training_plan.planned_participants,
              planned_time: record.training_plan.planned_time,
              training_hours: record.training_plan.training_hours,
              assessment_method: record.training_plan.assessment_method,
              exam_method: record.training_plan.exam_method,
              status: record.training_plan.status,
              actual_participants: 0,
              passed: 0,
              created_time: record.training_plan.created_time,
              updated_time: record.training_plan.updated_time
            }));
      
            return successResponse(res, {
              records: formattedStatistics,
              total,
              page: Number(page),
              pageSize: Number(pageSize)
            }, '获取课件列表成功');
        } catch (error) {
            return errorResponse(res, 500, '服务器内部错误', null);
        }
    }

    async getListGroup(req: Request, res: Response): Promise<Response> {
        try {
            const { page = 1, pageSize = 20, keyword, category, status, sort } = req.query;
            
            // 构建查询条件
            const queryBuilder = AppDataSource.getRepository(Branch)
              .createQueryBuilder('branch')
              .where('branch.enabled = :enabled', { enabled: true });
            
            // 添加筛选条件
            if (keyword) {
              queryBuilder.andWhere('(branch.name LIKE :keyword OR branch.abbreviation LIKE :keyword)', { keyword: `%${keyword}%` });
            }
      
            // 添加排序
            if (sort) {
              const order = String(sort).substring(0, 1);
              const field = String(sort).substring(1);
              if (field && order) {
                queryBuilder.orderBy(`branch.${field}`, order === "+" ? "ASC" : "DESC");
              }
            } else {
              queryBuilder.orderBy('branch._id', 'ASC');
            }
      
            // 分页
            const total = await queryBuilder.getCount();
            const branchs = await queryBuilder
              .skip((Number(page) - 1) * Number(pageSize))
              .take(Number(pageSize))
              .getMany();
      
            // 格式化返回数据
            const formattedStatistics = branchs.map(branch => ({
              id: branch._id,
              name: branch.name,
              abbreviation: branch.abbreviation,
              code: branch.code,
              contact: branch.contact,
              total: 0,
              finished: 0,
              incomplete: 0,
              planned: 0,
              actual: 0,
              created_time: branch.create_time,
              updated_time: branch.update_time
            }));

            // 根据培训计划范围查询分公司涉及的培训计划数量
            const subQueryBuilder = AppDataSource.getRepository(TrainingPlanScope)
             .createQueryBuilder('scope')
             .where('scope.branch_id IN (branch_ids)')
             .select('scope.training_plan_id')
             .getQuery();
            const subQuery = subQueryBuilder.replace('branch_ids', branchs.map(branch => branch._id).join(','));
            // 统计每个分公司的培训计划数量
            const planCountResult = await AppDataSource.query(`
                SELECT branch_id, COUNT(*) as total FROM training.tr_training_plan_scopes
                WHERE training_plan_id IN (${subQuery})
                GROUP BY branch_id
            `);
            // 更新分公司的培训计划数量
            formattedStatistics.forEach(branch => {
                const count = planCountResult.find((item: any) => item.branch_id === branch.id);
                branch.total = count?.total || 0;
                branch.incomplete = branch.total - branch.finished;
            });

            // 根据 TrainingRecordParticipant 统计计划参培人数
            const participantCountResult = await AppDataSource.query(`
                SELECT sb.user.branch, COUNT(*) as planned
                FROM training.tr_training_record_participants
                INNER JOIN training.tr_training_records ON training.tr_training_record_participants.training_record_id = training.tr_training_records.id
                INNER JOIN sb.user ON sb.user._id = training.tr_training_record_participants.user_id
                WHERE training.tr_training_records.training_plan_id IN (${subQuery})
                GROUP BY sb.user.branch
            `);
            
            // 更新分公司的参培人数
            formattedStatistics.forEach(branch => {
                const count = participantCountResult.find((item: any) => item.branch === branch.id);
                branch.planned = count?.planned || 0;
            });
      
            return successResponse(res, {
              records: formattedStatistics,
              total,
              page: Number(page),
              pageSize: Number(pageSize)
            }, '获取课件列表成功');
        } catch (error) {
            return errorResponse(res, 500, '服务器内部错误', null);
        }
    }

    async create(req: Request, res: Response): Promise<Response> {
        try {
            const { 
                participants,
                participants_outer,
                contents,
                contents_select,
                contents_matrix,
                coursewares
            } = req.body;
            
            // 检查表单数据
            if ((!participants || participants.length === 0) && (!participants_outer || participants_outer.length === 0)) {
                return errorResponse(res, 400, '参与人员不能为空', null);
            }

            // 开始事务
            const queryRunner = AppDataSource.createQueryRunner();
            await queryRunner.connect();
            await queryRunner.startTransaction();
            
            try {
                // 创建培训记录
                const trainingPlanRepository = queryRunner.manager.getRepository(TrainingPlan);
                
                // 获取培训计划信息
                const trainingPlan = await trainingPlanRepository.findOne({ where: { _id: req.body.id } });
                if (!trainingPlan) {
                    return errorResponse(res, 404, '培训计划不存在', null);
                }
                
                // 创建培训记录
                const trainingRecord = new TrainingRecord();
                trainingRecord.training_plan_id = trainingPlan._id;
                trainingRecord.actual_time = new Date();
                trainingRecord.actual_participants = (participants?.length || 0) + (participants_outer?.length || 0);
                trainingRecord.qualified_participants = 0; // 初始合格人数为0
                trainingRecord.content_notes = contents || '';
                trainingRecord.content_type = trainingPlan.training_category;
                trainingRecord.status = 1;
                trainingRecord.creator = (req as any).user?._id;
                trainingRecord.updater = (req as any).user?._id;
                
                const savedRecord = await queryRunner.manager.save(trainingRecord);

                // 插入参与人员
                if (participants && participants.length > 0) {
                    const participantEntities = participants.map((userId: number) => {
                        const participant = new TrainingRecordParticipant();
                        participant.training_record_id = savedRecord.id;
                        participant.user_id = userId;
                        participant.is_qualified = 0;
                        participant.is_trainer = 0;
                        return participant;
                    });
                    await queryRunner.manager.save(participantEntities);
                }
                
                // 插入外部参与人员
                if (participants_outer && participants_outer.length > 0) {
                    const outerParticipantEntities = participants_outer.map((workerId: number) => {
                        const participant = new TrainingRecordParticipant();
                        participant.training_record_id = savedRecord.id;
                        participant.worker_id = workerId;
                        participant.is_qualified = 0;
                        participant.is_trainer = 0;
                        return participant;
                    });
                    await queryRunner.manager.save(outerParticipantEntities);
                }

                // 插入培训记录与课件关联
                if (coursewares && coursewares.length > 0) {
                    const coursewareEntities = coursewares.map((coursewareId: number) => {
                        const recordCourseware = new TrainingRecordCourseware();
                        recordCourseware.training_record_id = savedRecord.id;
                        recordCourseware.courseware_id = coursewareId;
                        return recordCourseware;
                    });
                    await queryRunner.manager.save(coursewareEntities);
                }

                // 插入培训内容
                console.log('trainingPlan', trainingPlan);
                if (trainingPlan.training_category === 1 || trainingPlan.training_category === 2) {
                    console.log('contents_select', contents_select);
                    if (contents_select && contents_select.length > 0) {
                        const contentPromises = contents_select.map(async (content: { name: string, url: string }) => {
                            const material = new Material();
                            material.title = content.name;
                            material.file_path = content.url;
                            const savedMaterial = await queryRunner.manager.save(material);
                            const recordContent = new TrainingRecordContent();
                            recordContent.training_record_id = savedRecord.id;
                            recordContent.content_id = savedMaterial._id;
                            return queryRunner.manager.save(recordContent);
                        });
                        await Promise.all(contentPromises);
                    }
                } else if (trainingPlan.training_category === 3 || trainingPlan.training_category === 4) {
                    console.log('contents_matrix', contents_matrix);
                    if (contents_matrix && contents_matrix.length > 0) {
                        const matrixContentEntities = contents_matrix.map((matrixId: number) => {
                            const recordCourseware = new TrainingRecordContent();
                            recordCourseware.training_record_id = savedRecord.id;
                            recordCourseware.content_id = matrixId;
                            return recordCourseware;
                        });
                        await queryRunner.manager.save(matrixContentEntities);
                    }
                }
            
                // 提交事务
                await queryRunner.commitTransaction();
                return successResponse(res, { id: savedRecord.id }, '创建培训记录成功');
            } catch (error) {
                // 回滚事务
                await queryRunner.rollbackTransaction();
                throw error;
            } finally {
                // 释放查询运行器
                await queryRunner.release();
            }
        } catch (error) {
            console.error('创建培训记录失败:', error);
            return errorResponse(res, 500, '服务器内部错误', null);
        }
    }

    async getDetail(req: Request, res: Response): Promise<Response> {
        try {
            const id = req.params.id;
            const trainingRecordRepository = AppDataSource.getRepository(TrainingRecord);
            const trainingRecord = await trainingRecordRepository.findOne({
                where: { id: Number(id) }
            });
            if (!trainingRecord) {
                return errorResponse(res, 404, '培训记录不存在', null);
            }
            return successResponse(res, trainingRecord, '获取培训记录详情成功');
        } catch (error) {
            console.error('获取培训记录详情失败:', error);
            return errorResponse(res, 500, '服务器内部错误', null);
        }
    }

    async getParticipants(req: Request, res: Response): Promise<Response> {
        try {
            const id = req.params.id;
            const participantRepository = AppDataSource.getRepository(TrainingRecordParticipant);
            const trainingRecordParticipants = await participantRepository.find({
                where: { training_record_id: Number(id) }
            });
            if (!trainingRecordParticipants) {
                return errorResponse(res, 404, '培训记录人员不存在', null);
            }
            const userIds = trainingRecordParticipants.map(participant => participant.user_id);
            const workerIds = trainingRecordParticipants.map(participant => participant.worker_id);
            const userRepository = AppDataSource.getRepository(User);
            const workerRepository = AppDataSource.getRepository(ConstructionWorker);
            const users = await userRepository.find({
                where: { _id: In(userIds) },
                relations: ['branchEntity']
            });
            const workers = await workerRepository.find({
                where: { _id: In(workerIds) },
                relations: ['branchEntity']
            });
            // 获取考试记录
            const examRecordRepository = AppDataSource.getRepository(ExamRecord);
            const examRecords = await examRecordRepository.find({
                where: { training_record_id: Number(id) }
            });
            const examRecordMap = new Map<number, ExamRecord>()
            examRecords.forEach(record => {
                examRecordMap.set(record.participant_id, record);
            })
            const participants = [...users, ...workers].map(participant => {
                return {
                    id: participant._id,
                    name: participant instanceof User ? participant.realname : participant.name,
                    type: participant instanceof User ? participant.type : 0,
                    gender: participant instanceof User ? 0 : participant.sex,
                    age: participant instanceof User ? participant.age : 0,
                    organization: participant.branchEntity?.name || '',
                    idcard: 0,
                    hours: 0,
                    passed: examRecordMap.get(participant._id)?.is_passed,
                    score: examRecordMap.get(participant._id)?.score
                }
            });
            return successResponse(res, participants, '获取培训记录人员成功');
        } catch (error) {
            console.error('获取培训记录人员失败:', error);
            return errorResponse(res, 500, '服务器内部错误', null);
        }
    }

    async getMyStat(req: Request, res: Response): Promise<Response> {
        try {
            const userId = (req as any).user._id;
            // 获取用户信息
            const userRepository = AppDataSource.getRepository(User);
            const user = await userRepository.findOne({
                where: { _id: userId },
                relations: ['branchEntity']
            });
            if (!user) {
                return errorResponse(res, 404, '用户不存在', null);
            }
            const tasks = [] as MyTask[];
            // 获取我的任务
            const taskAssignmentRepository = AppDataSource.getRepository(TaskAssignment);
            const assignments = await taskAssignmentRepository.find({
                where: { user_id: userId, task: { status: Not(0) } },
                relations: ['task']
            });
            for (const assignment of assignments) {
                tasks.push({
                    id: assignment.task._id,
                    type: 1,
                    title: assignment.task.title,
                    description: assignment.task.description,
                    trainer: "",
                    progress: assignment.progress,
                    duration: assignment.study_duration,
                    result: assignment.is_passed,
                    assessmentMethod: 0,
                })
            }
            // 获取培训
            const trainingParticipantRepository = AppDataSource.getRepository(TrainingRecordParticipant);
            const trainingRecords = await trainingParticipantRepository.find({
                where: { user_id: userId },
                relations: ['training_record', 'training_record.training_plan']
            });
            for (const record of trainingRecords) {
                tasks.push({
                    id: record.id,
                    type: 2,
                    title: record.training_record?.training_plan?.name || '',
                    description: "",
                    trainer: "",
                    progress: 0,
                    duration: record.training_record?.training_plan?.training_hours || 0,
                    result: false,
                    assessmentMethod: record.training_record?.training_plan?.assessment_method || 0,
                })
            }
            tasks.sort((a, b) => {
                if (a.result !== b.result) {
                    return a.result ? 1 : -1;
                }
                return 0;
            })
            // 获取我的证书
            const certificateRepository = AppDataSource.getRepository(Certificate);
            const certificatesData = await certificateRepository.find({
                where: { user_id: userId, is_deleted: false },
                relations: ['template']
            });
            const certificates = certificatesData.slice(-10).map(cert => ({
                id: cert.id,
                type: cert.template?.cer_type,
                title: cert.template?.name || '',
                awardTime: cert.issue_date,
            }))

            const stats = {
                totalTrainings: trainingRecords.length,
                completedTrainings: 0,
                totalHours: 0,
                passedExams: 0,
                averageScore: 0,
                recentTrainings: [],
                certificateCount: certificates.length
            }
            const profile = {
                name: user.name,
                realname: user.realname,
                email: user.email,
                phone: user.phone,
                branch: {
                    name: user.branchEntity?.name || '',
                },
                joinDate: user.join_date ? parseTime(new Date(user.join_date), "{y}-{m}-{d}") : "",
                oa_id: user.oa_id,
                age: user.age,
                married: user.married,
            }
            
            return successResponse(res, {
                stats,
                profile,
                tasks,
                certificates
            }, '获取培训统计成功');
        } catch (error) {
            console.error('获取培训统计失败:', error);
            return errorResponse(res, 500, '服务器内部错误', null);
        }
    }

    async getMyTraining(req: Request, res: Response): Promise<Response> {
        try {
            const id = req.params.id;
            return successResponse(res, id, '获取我的培训记录统计成功');
        } catch (error) {
            console.error('获取培训记录失败:', error);
            return errorResponse(res, 500, '服务器内部错误', null);
        }
    }
}