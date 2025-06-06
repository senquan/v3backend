import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { SettingsController } from '../controllers/settings.controller';

const router = Router();
const settingsController = new SettingsController();

// 获取设置列表
router.get('/site', settingsController.getSiteList);

// 应用认证中间件
router.use(authMiddleware);

// 获取设置列表
router.get('/list', settingsController.getList);

// 批量获取设置
router.get('/batch', settingsController.getBatch);

// 获取设置详情
router.get('/:id', settingsController.getDetail);

// 批量设置
router.post('/batch', settingsController.batchUpdate);

// 创建设置
router.post('/', settingsController.create);

// 更新设置
router.put('/:id', settingsController.update);

// 删除设置
router.delete('/:id', settingsController.delete);

export default router;