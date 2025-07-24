import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { UserController } from '../controllers/user.controller';

const router = Router();
const userController = new UserController();

// 应用认证中间件
router.use(authMiddleware);

// 获取用户列表
router.get('/list', userController.getList);

// 获取用户详情
router.get('/:id', userController.getDetail);

export default router;