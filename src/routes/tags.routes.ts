import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { TagsController } from '../controllers/tags.controller';

const router = Router();
const tagsController = new TagsController();

// 应用认证中间件
router.use(authMiddleware);

// 获取标签列表
router.get('/list', tagsController.getList);

// 获取平台标签列表
router.get('/platform/:id', tagsController.getPlatformTags);

// 批量更新标签
router.put('/batch', tagsController.batchUpdateTags);

// 获取标签详情
router.get('/:id', tagsController.getDetail);

// 创建标签
router.post('/', tagsController.create.bind(tagsController));

// 更新标签
router.put('/:id', tagsController.update.bind(tagsController));

// 删除标签
router.delete('/:id', tagsController.delete);

export default router;