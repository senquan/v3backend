import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { UserController } from '../controllers/user.controller';

const router = Router();
const userController = new UserController();

// 应用认证中间件
router.use(authMiddleware);

// 获取用户列表
router.get('/list', userController.getList);

// 获取本地用户列表
router.get('/local', authMiddleware, userController.getLocalList);

// 获取用户信息
router.get('/me', authMiddleware, userController.getProfile.bind(userController));

// 更新用户角色
router.put('/:id/role', authMiddleware, userController.updateUserRole.bind(userController));

// 获取用户角色列表
router.get('/:id/roles', authMiddleware, userController.getUserRoles.bind(userController));

// 获取用户权限列表
router.get('/permissions', authMiddleware, userController.getUserPermissions.bind(userController));

// 获取用户学习统计
router.get('/learning-stats', userController.getLearningStats.bind(userController));

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

// 获取用户相关课程
router.get('/course/:courseId/related', userController.getRelatedCourses.bind(userController));

// 获取用户课程详情
router.get('/course/:courseId/:partId', userController.myCourseDetail.bind(userController));

// 更新用户课程章节学习进度
router.put('/course/:chapterId/chapter-progress', userController.updateChapterProgress.bind(userController));

// 完成用户课程章节
router.put('/course/:chapterId/complete/:progressId', userController.completeChapter.bind(userController));

export default router;