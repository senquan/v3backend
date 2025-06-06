import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { SpecController } from '../controllers/spec.controller';

const router = Router();
const specController = new SpecController();

// 应用认证中间件
router.use(authMiddleware);

// 获取规格组列表
router.get('/list', specController.getGroupList);

// 获取规格组详情
router.get('/:id', specController.getGroupDetail);

// 创建规格组
router.post('/', specController.createGroup);

// 更新规格组
router.put('/:id', specController.updateGroup);

// 删除规格组
router.delete('/:id', specController.deleteGroup);

// 创建规格
router.post('/item', specController.createItem);

// 更新规格组
router.put('/item/:id', specController.updateItem);

// 删除规格组
router.delete('/item/:id', specController.deleteItem);

export default router;