import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { TrainingPlanController } from '../controllers/trainingPlan.controller';

const router = Router();
const planController = new TrainingPlanController();

// 应用认证中间件
//router.use(authMiddleware);

// 获取培训计划列表
router.get('/list', planController.getList);

// 获取培训计划详情
router.get('/:id', planController.getDetail);

// 创建培训计划
router.post('/', planController.create);

// 更新培训计划
router.put('/:id', planController.update);

// 删除培训计划
router.delete('/:id', planController.delete);

// 批量删除培训计划
router.post('/batch/delete', planController.batchDelete);

export default router;