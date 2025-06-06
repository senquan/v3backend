import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { DashboardController } from '../controllers/dashboard.controller';

const router = Router();
const dashboardController = new DashboardController();

// 获取仪表盘统计数据
router.get('/stats', authMiddleware, dashboardController.getDashboardStats.bind(dashboardController));

export default router;