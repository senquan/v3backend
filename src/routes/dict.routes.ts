import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { DictController } from '../controllers/dict.controller';

const router = Router();
const dictController = new DictController();

// 应用认证中间件
router.use(authMiddleware);

// 获取字典列表
router.get('/list', dictController.getList);

// 获取字典详情
router.get('/:id', dictController.getDetail);

// 创建字典
router.post('/', dictController.create);

// 更新字典
router.put('/:id', dictController.update);

// 删除字典
router.delete('/:id', dictController.delete);

export default router;