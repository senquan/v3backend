import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { CoursewareController } from '../controllers/courseware.controller';

const router = Router();
const coursewareController = new CoursewareController();

// 应用认证中间件
router.use(authMiddleware);

// 获取课件列表
router.get('/list', coursewareController.getList.bind(coursewareController));

// 获取课件详情
router.get('/detail/:id', coursewareController.getDetail.bind(coursewareController));

// 创建课件
router.post('/create', coursewareController.create.bind(coursewareController));

// 更新课件
router.put('/update/:id', coursewareController.update.bind(coursewareController));

// 删除课件
router.delete('/delete/:id', coursewareController.delete.bind(coursewareController));

// 批量删除课件
router.post('/batch-delete', coursewareController.batchDelete.bind(coursewareController));

// 更新课件下载次数
router.put('/download/:id', coursewareController.updateDownloadCount.bind(coursewareController));

// 关联培训资料
router.post('/associate-materials', coursewareController.associateMaterials.bind(coursewareController));

// 获取课件关联的培训资料
router.get('/materials/:id', coursewareController.getAssociatedMaterials.bind(coursewareController));

export default router;