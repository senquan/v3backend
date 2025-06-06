import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { StaffController } from '../controllers/staff.controller';

const router = Router();
const staffController = new StaffController();

// 应用认证中间件
router.use(authMiddleware);

// 获取员工列表
router.get('/list', staffController.getList);

// 获取员工详情
router.get('/:id', staffController.getDetail);

// 创建员工
router.post('/', staffController.create);

// 更新员工
router.put('/:id', staffController.update);

// 删除员工
router.delete('/:id', staffController.delete);

export default router;