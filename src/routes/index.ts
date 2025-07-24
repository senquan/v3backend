import { Router, Request, Response } from 'express';
import authRoutes from './auth.routes';
import branchRoutes from './branch.routes';
import categoryRoutes  from './category.routes';
import coursewareRoutes from './courseware.routes';
import examRoutes from './exam.routes';
import materialRoutes from './material.routes';
import planRoutes from './plan.routes';
import questionRoutes from './question.routes';
import recordRoutes from './record.routes';
import surveyRoutes from './survey.routes';
import tagRoutes from './tag.routes';
import trainerRoutes from './trainer.routes';
import trainingMatrixRoutes from './trainingMatrix.routes';
import certificateRoutes from './certificate.routes';
import taskRoutes from './task.routes';
import uploadRoutes  from './upload.routes';
import userRoutes from './user.routes';

const router = Router();

// 注册各个模块的路由
router.use('/v1/auth', authRoutes);
router.use('/v1/branch', branchRoutes);
router.use('/v1/category', categoryRoutes);
router.use('/v1/courseware', coursewareRoutes);
router.use('/v1/exam', examRoutes);
router.use('/v1/material', materialRoutes);
router.use('/v1/plan', planRoutes);
router.use('/v1/question', questionRoutes);
router.use('/v1/record', recordRoutes);
router.use('/v1/survey', surveyRoutes);
router.use('/v1/tag', tagRoutes);
router.use('/v1/trainer', trainerRoutes);
router.use('/v1/matrix', trainingMatrixRoutes);
router.use('/v1/certificate', certificateRoutes);
router.use('/v1/task', taskRoutes);
router.use('/v1/upload', uploadRoutes);
router.use('/v1/user', userRoutes);

// 处理404情况 - 当没有匹配到路由时
router.use('*', (req: Request, res: Response) => {
  res.status(404).json({
    code: 404,
    message: '请求的API路径不存在',
    data: null
  });
});

export default router;