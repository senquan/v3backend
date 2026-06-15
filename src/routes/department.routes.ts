import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { DepartmentController } from '../controllers/department.controller';

const router = Router();
const departmentController = new DepartmentController();

// 应用认证中间件
router.use(authMiddleware);

// 获取部门树形列表
router.get('/tree', departmentController.getTree.bind(departmentController));

// 获取部门详情
router.get('/:id', departmentController.getDetail.bind(departmentController));

// 创建部门
router.post('/', departmentController.create.bind(departmentController));

// 更新部门
router.put('/:id', departmentController.update.bind(departmentController));

// 删除部门
router.delete('/:id', departmentController.delete.bind(departmentController));

// 获取部门成员列表
router.get('/:id/members', departmentController.getMembers.bind(departmentController));

// 将成员移入部门
router.post('/:id/members', departmentController.addMembers.bind(departmentController));

// 将成员移出部门
router.delete('/:id/members', departmentController.removeMembers.bind(departmentController));

export default router;
