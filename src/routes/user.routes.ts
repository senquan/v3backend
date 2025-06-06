import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { UserController } from '../controllers/user.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();
const userController = new UserController();

// 获取用户信息
router.get('/me', authMiddleware, (req: Request, res: Response) => userController.getProfile(req, res));

// 更新用户信息
router.put('/profile', authMiddleware, (req: Request, res: Response) => userController.updateProfile(req, res));

// 更新用户密码
router.put('/password', authMiddleware, (req: Request, res: Response) => userController.updatePassword(req, res));

// 注册用户
router.post(
  '/register',
  [
    body('username').notEmpty().withMessage('用户名不能为空'),
    body('password').notEmpty().withMessage('密码不能为空'),
    body('code').notEmpty().withMessage('验证码不能为空'),
    body('inviteCode').notEmpty().withMessage('邀请码不能为空'),
  ],
  (req: Request, res: Response) => userController.register(req, res)
);

// 更新用户角色
router.put('/:id/role', authMiddleware, (req: Request, res: Response) => userController.updateRole(req, res));

// 获取未绑定用户列表
router.get('/unbind', authMiddleware, (req: Request, res: Response) => userController.getUnbindUsers(req, res));

// 获取用户角色列表
router.get('/:id/roles', authMiddleware, (req: Request, res: Response) => userController.getUserRoles(req, res));

// 获取用户权限列表
router.get('/permissions', authMiddleware, (req: Request, res: Response) => userController.getUserPermissions(req, res));

export default router;