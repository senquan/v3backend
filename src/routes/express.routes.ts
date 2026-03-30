import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { expressTrackingController } from '../controllers/express-tracking.controller';

const router = Router();
const controller = expressTrackingController;

/**
 * 快递跟踪管理路由
 * 基础路径: /api/v1/express
 */

// 所有路由都需要认证
router.use(authMiddleware);

// 获取快递列表
router.get('/', controller.getList);

// 创建快递拦截记录
router.post('/create', controller.create);

// 获取统计数据
router.get('/statistics', controller.getStatistics);

// 根据单号查询物流
router.get('/logistics/:trackingNumber', controller.getLogistics);

// 根据单号查询记录
router.get('/number/:trackingNumber', controller.getByNumber);

// 获取详情
router.get('/:id', controller.getDetail);

// 更新状态
router.put('/:id/status', controller.updateStatus);

// 入库操作
router.post('/:id/warehouse-in', controller.warehouseIn);

// 完结记录
router.post('/:id/close', controller.closeRecord);

// 删除记录
router.delete('/:id', controller.delete);

// 导出数据
router.get('/export/data', controller.exportData);

export default router;
