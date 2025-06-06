import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { CouponController } from '../controllers/coupon.controller';

const router = Router();
const couponController = new CouponController();

// 应用认证中间件
router.use(authMiddleware);

// 获取分类列表
router.get('/list', couponController.getList);

// 获取分类详情
router.get('/:id', couponController.getDetail);

// 创建分类
router.post('/', couponController.create);

// 更新分类
router.put('/:id', couponController.update);

// 删除分类
router.delete('/:id', couponController.delete);

export default router;