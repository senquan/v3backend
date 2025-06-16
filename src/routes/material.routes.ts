import { Router } from 'express';
import { MaterialController } from '../controllers/material.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();
const materialController = new MaterialController();

// 获取培训资料列表
router.get('/list', authMiddleware, materialController.getList);

// 获取培训资料详情
router.get('/:id', authMiddleware, materialController.getDetail);

// 创建培训资料
router.post('/', authMiddleware, materialController.create);

// 更新培训资料
router.put('/:id', authMiddleware, materialController.update);

// 删除培训资料
router.delete('/:id', authMiddleware, materialController.delete);

// 批量删除培训资料
router.post('/batch-delete', authMiddleware, materialController.batchDelete);

// 关联课件
router.post('/associate-courseware', authMiddleware, materialController.associateCourseware);

// 获取培训资料关联的课件
router.get('/:id/coursewares', authMiddleware, materialController.getAssociatedCoursewares);

export default router;