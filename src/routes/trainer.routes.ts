import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { TrainerController } from '../controllers/trainer.controller';

const router = Router();
const trainerController = new TrainerController();

// 应用认证中间件
router.use(authMiddleware);

// 获取讲师列表
router.get('/list', trainerController.getList.bind(trainerController));

// 获取讲师详情
router.get('/detail/:id', trainerController.getDetail.bind(trainerController));

// 创建讲师
router.post('/create', trainerController.create.bind(trainerController));

// 更新讲师
router.put('/update/:id', trainerController.update.bind(trainerController));

// 删除讲师
router.delete('/delete/:id', trainerController.delete.bind(trainerController));

// 批量删除讲师
router.post('/batch-delete', trainerController.batchDelete.bind(trainerController));

// 获取用户列表（用于关联用户）
router.get('/users', trainerController.getUsers.bind(trainerController));

// 获取标签列表（用于关联标签）
router.get('/tags', trainerController.getTags.bind(trainerController));

export default router;