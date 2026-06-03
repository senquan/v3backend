import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { ProductTbSkuController } from '../controllers/product-tb-sku.controller';

const router = Router();
const skuController = new ProductTbSkuController();

// 应用认证中间件
router.use(authMiddleware);

// 获取SKU列表
router.get('/list', skuController.getList);

// 获取SKU详情
router.get('/:id', skuController.getDetail);

// 创建SKU
router.post('/', skuController.create);

// 更新SKU
router.put('/:id', skuController.update);

// 删除SKU
router.delete('/:id', skuController.delete);

export default router;
