import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { UserController } from '../controllers/user.controller';

const router = Router();
const userController = new UserController();

// 应用认证中间件
router.use(authMiddleware);

// 获取用户列表
router.get('/list', userController.getList);

// 签到
router.put('/plan/:id/signin', userController.signin);

// 获取用户详情
router.get('/:id', userController.getDetail);

// 获取用户培训计划列表
router.get('/plan/list', userController.myPlanList.bind(userController));

// 获取用户培训计划详情
router.get('/plan/:id', userController.myPlanDetail);

// 获取用户最近学习记录
router.get('/record/recent', userController.myRecordList.bind(userController));

export default router;