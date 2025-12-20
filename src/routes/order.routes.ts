import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { OrderController } from '../controllers/order.controller';
import { ReturnOrderController } from '../controllers/return-order.controller';

const router = Router();
const orderController = new OrderController();
const returnOrderController = new ReturnOrderController();

// 应用认证中间件
router.use(authMiddleware);

// 获取订单列表
router.get('/list', orderController.getList);

router.get('/sales', authMiddleware, orderController.getSalesReport);

router.get('/category', authMiddleware, orderController.getCategoryReport);

// 获取订单详情
router.get('/:id', orderController.getDetail);

// 获取订单状态变更历史
router.get('/:id/log', orderController.getStatusLog.bind(orderController));

// 创建订单
router.post('/', orderController.create.bind(orderController));

// 更新订单状态
router.put('/:id/status', orderController.updateStatus.bind(orderController));

// 更新订单类型
router.put('/:id/type', orderController.changeOrderType.bind(orderController));

// 更新订单价格版本
router.put('/:id/version', orderController.changeOrderVersion.bind(orderController));

// 更新订单平台
router.put('/:id/platform', orderController.changeOrderPlatform.bind(orderController));

// 更新订单
router.put('/:id', orderController.update.bind(orderController));

// 删除订单
router.delete('/:id', orderController.delete);

// 计算订单价格
// router.post('/price', orderController.calculatePrice);

// 退货订单相关路由
// 获取退货订单列表
router.get('/return/list', returnOrderController.getList);

// 获取退货订单详情
router.get('/return/:id', returnOrderController.getDetail);

// 创建退货订单
router.post('/return', returnOrderController.create.bind(returnOrderController));

// 更新退货订单状态
router.put('/return/:id/status', returnOrderController.updateStatus);

// 删除退货订单
router.delete('/return/:id', returnOrderController.delete);


export default router;