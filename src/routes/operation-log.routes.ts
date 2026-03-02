import { Router } from 'express';
import { OperationLogController } from '../controllers/operation-log.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();
const operationLogController = new OperationLogController();

// 所有路由都需要认证
router.use(authMiddleware);

// 获取操作日志列表
router.get('/', operationLogController.getLogList.bind(operationLogController));

// 获取操作日志详情
router.get('/:id', operationLogController.getLogDetail.bind(operationLogController));

// 创建操作日志
router.post('/', operationLogController.createLog.bind(operationLogController));

// 更新操作日志
router.put('/:id', operationLogController.updateLog.bind(operationLogController));

// 删除操作日志
router.delete('/:id', operationLogController.deleteLog.bind(operationLogController));

// 批量删除操作日志
router.delete('/', operationLogController.batchDeleteLogs.bind(operationLogController));

// 获取操作日志统计
router.get('/statistics/summary', operationLogController.getLogStatistics.bind(operationLogController));

// 获取操作类型选项
router.get('/options/types', operationLogController.getOperationTypes.bind(operationLogController));

// 获取状态选项
router.get('/options/status', operationLogController.getStatusOptions.bind(operationLogController));

export default router;