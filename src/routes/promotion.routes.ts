import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { PromotionController } from '../controllers/promotion.controller';

const router = Router();
const promotionController = new PromotionController();

// 应用认证中间件
router.use(authMiddleware);

// 获取促销活动列表
router.get('/list', promotionController.getList);

// 获取促销活动及规则(计价用)
router.get('/list/price', promotionController.getListWithRules);

// 获取促销活动详情
router.get('/:id', promotionController.getDetail);

// 创建促销活动
router.post('/', promotionController.create);

// 批量转换规则
router.post('/:id/rule/convert', promotionController.convertRule);

// 更新促销活动
router.put('/:id', promotionController.update);

// 删除促销活动
router.delete('/:id', promotionController.delete);

// 获取规则列表
router.get('/rule/list', promotionController.getRules);

// 获取规则详情
router.get('/rule/:id', promotionController.getRule);

// 创建规则
router.post('/rule', promotionController.addRule);

// 更新规则
router.put('/rule/:id', promotionController.updateRule);

// 删除规则
router.delete('/rule/:id', promotionController.deleteRule);

export default router;