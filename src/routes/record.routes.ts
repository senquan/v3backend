import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { TrainingRecordController } from '../controllers/trainingRecord.controller';

const router = Router();
const recordController = new TrainingRecordController();

// 应用认证中间件
router.use(authMiddleware);

// 获取培训计划分组
router.get('/group', recordController.getListGroup);

// 获取培训计划列表
router.get('/list', recordController.getList);

// 获取培训计划人员列表
router.get('/:id/participants', recordController.getParticipants);

// 获取培训计划详情
router.get('/:id', recordController.getDetail);

// 创建培训计划
router.post('/', recordController.create);

// 更新培训计划
//router.put('/:id', recordController.update);

// 删除培训计划
//router.delete('/:id', recordController.delete);

// 批量删除培训计划
//router.post('/batch/delete', recordController.batchDelete);

export default router;