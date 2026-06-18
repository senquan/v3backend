import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { CsController } from '../controllers/cs.controller';

const router = Router();
const csController = new CsController();

// 应用认证中间件
router.use(authMiddleware);

// AI 客服聊天
router.post('/chat', csController.chat.bind(csController));

// 获取 AI 客服配置
router.get('/config', csController.getConfig.bind(csController));

// 保存 AI 客服配置
router.post('/config', csController.saveConfig.bind(csController));

// 获取知识库选项（沙箱用）
router.get('/kb-options', csController.getKbOptions.bind(csController));

export default router;
