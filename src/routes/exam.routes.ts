import { Router } from 'express';
import { ExamController } from '../controllers/exam.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();
const examController = new ExamController();

// 应用认证中间件
router.use(authMiddleware);

// 生成考试
router.post('/generate/:id', examController.generateExamByRecord.bind(examController));

// 获取我的考试列表
router.get('/mylist', examController.getMyList.bind(examController));

// 获取考试列表
router.get('/list', examController.getList.bind(examController));

// 获取考试详情
router.get('/:id', examController.getDetail.bind(examController));

// 更新考试设置
router.put('/:id/settings', examController.updateSettings.bind(examController));

// 重新生成考试题目
router.post('/:id/regenerate', examController.regenerateExam.bind(examController));

export default router;