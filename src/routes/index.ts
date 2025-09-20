import { Router, Request, Response } from 'express';
import authRoutes from './auth.routes';
import bulletinRoutes from './bulletin.routes';
import couponRoutes from './coupon.routes';
import customerRoutes from './customer.routes';
import userRoutes from './user.routes';
import roleRoutes from './role.routes';
import dashboardRoutes from './dashboard.routes';
import orderRoutes from './order.routes';
import productRoutes from './product.routes';
import tagsRoutes  from './tags.routes';
import specRoutes  from './spec.routes';
import staffRoutes  from './staff.routes';
import categoryRoutes  from './category.routes';
import dictRoutes  from './dict.routes';
import promotionRoutes  from './promotion.routes';
import promotionv3Routes  from './promotionv3.routes';
import uploadRoutes  from './upload.routes';
import ticketRoutes  from './ticket.routes';
import settingsRoutes  from './settings.routes';
import notificationRoutes  from './notification.routes';
import galleryRoutes  from './gallery.routes';

const router = Router();

// 注册各个模块的路由
router.use('/v1/auth', authRoutes);
router.use('/v1/bulletin', bulletinRoutes);
router.use('/v1/coupon', couponRoutes);
router.use('/v1/customer', customerRoutes);
router.use('/v1/users', userRoutes);
router.use('/v1/roles', roleRoutes);
router.use('/v1/product', productRoutes);
router.use('/v1/dashboard', dashboardRoutes);
router.use('/v1/order', orderRoutes);
router.use('/v1/tags', tagsRoutes);
router.use('/v1/spec', specRoutes);
router.use('/v1/staff', staffRoutes);
router.use('/v1/category', categoryRoutes);
router.use('/v1/dict', dictRoutes);
router.use('/v1/promotion', promotionRoutes);
router.use('/v1/promotionv3', promotionv3Routes);
router.use('/v1/upload', uploadRoutes);
router.use('/v1/ticket', ticketRoutes);
router.use('/v1/settings', settingsRoutes);
router.use('/v1/notifications', notificationRoutes);
router.use('/v1/gallery', galleryRoutes);

// 处理404情况 - 当没有匹配到路由时
router.use('*', (req: Request, res: Response) => {
  res.status(404).json({
    code: 404,
    message: '请求的API路径不存在',
    data: null
  });
});

export default router;