import { Router } from 'express';
import { RoleController } from '../controllers/role.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();
const roleController = new RoleController();

// 创建角色
router.post('/', authMiddleware, roleController.create);

// 获取角色列表
router.get('/list', authMiddleware, roleController.getList);

// 获取角色详情
router.get('/:id', authMiddleware, roleController.getDetail);

// 更新角色
router.put('/:id', authMiddleware, roleController.update);

// 删除角色
router.delete('/:id', authMiddleware, roleController.delete);

// 更新角色状态
router.patch('/:id/status', authMiddleware, roleController.updateStatus);

// 获取角色的资源标签列表
router.get('/:id/tags', authMiddleware, roleController.getTags);

// 更新角色的资源标签列表
router.put('/:id/tags', authMiddleware, roleController.updateTags);

// 获取角色的权限列表
router.get('/:id/permissions', authMiddleware, roleController.getPermissions.bind(roleController));

// 更新角色的权限列表
router.put('/:id/permissions', authMiddleware, roleController.updatePermissions.bind(roleController));

export default router;