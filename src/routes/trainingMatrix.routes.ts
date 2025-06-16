import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { MatrixController } from '../controllers/matrix.controller';

const router = Router();
const matrixController = new MatrixController();

// 应用认证中间件
router.use(authMiddleware);

// 获取岗位安全培训矩阵列表
router.get('/list', matrixController.getList);

// 获取岗位安全培训矩阵详情
router.get('/:id', matrixController.getDetail);

// 创建岗位安全培训矩阵
router.post('/', matrixController.create);

// 更新岗位安全培训矩阵
router.put('/:id', matrixController.update);

// 删除岗位安全培训矩阵
router.delete('/:id', matrixController.delete);

export default router;