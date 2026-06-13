import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { FaqController } from '../controllers/faq.controller';

const router = Router();
const faqController = new FaqController();

// 应用认证中间件
router.use(authMiddleware);

// 获取FAQ列表
router.get('/list', faqController.getList);

// 获取业务标签列表
router.get('/tags', faqController.getBusinessTags);

// 导出FAQ
router.get('/export', faqController.exportList);

// 创建FAQ
router.post('/', faqController.create.bind(faqController));

// 更新FAQ
router.put('/:id', faqController.update.bind(faqController));

// 删除FAQ
router.delete('/:id', faqController.delete);

export default router;
