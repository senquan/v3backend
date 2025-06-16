import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { errorResponse, successResponse } from '../utils/response';
import { Material } from '../models/entities/Material.entity';
import { TrainingRecord } from '../models/entities/TrainingRecord.entity';
import { TrainingRecordParticipant } from '../models/entities/TrainingRecordParticipant.entity';
import { TrainingRecordCourseware } from '../models/entities/TrainingRecordCourseware.entity';
import { TrainingRecordContent } from '../models/entities/TrainingRecordContent.entity';
import { TrainingPlan } from '../models/entities/TrainingPlan.entity';
import { Branch } from '../models/entities/Branch.entity';
import { finished } from 'stream';

export class TrainingRecordController {
  
    async getList(req: Request, res: Response): Promise<Response> {
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
              created_time: branch.created_time,
              updated_time: branch.updated_time
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
                trainingRecord.creator = (req as any).user?.id;
                trainingRecord.updater = (req as any).user?.id;
                
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
}