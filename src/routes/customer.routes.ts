import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { CustomerController } from '../controllers/customer.controller';

const router = Router();
const customerController = new CustomerController();

// 应用认证中间件
router.use(authMiddleware);

// 获取分类列表
router.get('/list', customerController.getList);

// 获取分类详情
router.get('/:id', customerController.getDetail);

// 创建分类
router.post('/', customerController.create);

// 更新分类
router.put('/:id', customerController.update);

// 删除分类
router.delete('/:id', customerController.delete);

export default router;