import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { CategoryController } from '../controllers/category.controller';

const router = Router();
const categoryController = new CategoryController();

// 应用认证中间件
router.use(authMiddleware);

// 获取分类列表
router.get('/list', categoryController.getList);

// 获取分类详情
router.get('/:id', categoryController.getDetail);

// 创建分类
router.post('/', categoryController.create);

// 更新分类
router.put('/:id', categoryController.update);

// 删除分类
router.delete('/:id', categoryController.delete);

export default router;