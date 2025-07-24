import { Router } from 'express';
import { MaterialController } from '../controllers/material.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();
const materialController = new MaterialController();

// 应用认证中间件
router.use(authMiddleware);

// 获取培训资料列表
router.get('/list', materialController.getList);

// 获取培训资料详情
router.get('/:id', materialController.getDetail);

// 创建培训资料
router.post('/', materialController.create);

// 更新培训资料
router.put('/:id', materialController.update);

// 删除培训资料
router.delete('/:id', materialController.delete);

// 批量删除培训资料
router.post('/batch-delete', materialController.batchDelete);

// 关联课件
router.post('/associate-courseware', materialController.associateCourseware);

// 获取培训资料关联的课件
router.get('/:id/coursewares', materialController.getAssociatedCoursewares);

export default router;