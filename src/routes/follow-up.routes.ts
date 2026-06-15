import { Router } from 'express';
import { FollowUpController } from '../controllers/follow-up.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();
const followUpController = new FollowUpController();

// 应用认证中间件
router.use(authMiddleware);

// 跟单配置
router.get('/configs', followUpController.getConfigs);
router.get('/configs/:id', followUpController.getConfig.bind(followUpController));
router.post('/configs', followUpController.createConfig.bind(followUpController));
router.put('/configs/:id', followUpController.updateConfig.bind(followUpController));
router.delete('/configs/:id', followUpController.deleteConfig.bind(followUpController));

// 跟单记录
router.get('/records', followUpController.getRecords.bind(followUpController));
router.put('/records/:id/complete', followUpController.completeRecord.bind(followUpController));
router.post('/records/generate', followUpController.generateRecords.bind(followUpController));

// 看板
router.get('/dashboard', followUpController.getDashboard.bind(followUpController));

export default router;
