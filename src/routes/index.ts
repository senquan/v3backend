import { Router, Request, Response } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import wsRoutes from './ws.routes';
import financeRoutes from './finance.routes';
import systemRoutes from './system.routes';
import basicRoutes from './basic.routes';
import reportRoutes from './report.routes';

const router = Router();

// 注册各个模块的路由
router.use('/v1/auth', authRoutes);
router.use('/v1/users', userRoutes);
router.use('/v1/ws', wsRoutes);
router.use('/v1/finance', financeRoutes);
router.use('/v1/system', systemRoutes);
router.use('/v1/basic', basicRoutes);
router.use('/v1/report', reportRoutes);

// 处理404情况 - 当没有匹配到路由时
router.use('*', (req: Request, res: Response) => {
  res.status(404).json({
    code: 404,
    message: '请求的API路径不存在',
    data: null
  });
});

export default router;