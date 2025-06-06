import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { ProductController } from '../controllers/product.controller';
import { resourceAccessMiddleware } from '../middlewares/resource-access.middleware';

const router = Router();
const productController = new ProductController();

// 应用认证中间件
router.use(authMiddleware);

// 获取商品列表
router.get('/list', productController.getList);

// 获取商品序列列表
router.get('/series/list', productController.fetchSeriesList);

// 获取商品类型列表
router.get('/models/list', productController.fetchModelList);

// 获取商品详情
router.get('/:id', async (req, res, next) => {
    // 获取商品标签
    const productId = Number(req.params.id);
    const productTags = await getProductTags(productId);
    
    // 如果商品没有标签，则允许访问
    if (!productTags.length) {
      return next();
    }
    
    // 使用资源访问中间件检查权限
    return resourceAccessMiddleware(productTags)(req, res, next);
  }, productController.getDetail);

// 创建商品
router.post('/', productController.create);

// 批量更新商品
router.put('/batch', productController.batchUpdatePrices);

// 更新商品
router.put('/:id', productController.update);

// 删除商品
router.delete('/:id', productController.delete);

// 批量删除商品
router.post('/batch/delete', productController.batchDeleteProducts);

// 批量导入商品
router.post('/import', productController.importProducts);

// 创建系列
router.post('/series/', productController.createSeries);

// 更新系列
router.put('/series/:id', productController.updateSeries);

// 删除系列
router.delete('/series/:id', productController.deleteSeries);

// 创建系列
router.post('/model/', productController.createModel);

// 更新系列
router.put('/model/:id', productController.updateModel);

// 删除系列
router.delete('/model/:id', productController.deleteModel);

async function getProductTags(productId: number): Promise<number[]> {
    return [];
}

export default router;