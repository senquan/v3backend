import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { UserController } from '../controllers/user.controller';
// import { validateRequest } from '../middlewares/validate.middleware';
// import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();
const userController = new UserController();
const authController = require('../controllers/auth.controller');

// 登录路由
router.post('/login', 
  [
    body('username').notEmpty().withMessage('用户名不能为空'),
    body('password').notEmpty().withMessage('密码不能为空')
  ],
  (req: Request, res: Response) => userController.login(req, res)
);

// 登出
router.post('/logout', (req: Request, res: Response) => {
  res.json({
    code: 0,
    message: '登出成功',
    data: null
  });
});

// 刷新token
router.post('/refresh-token', (req: Request, res: Response) => {
  res.json({
    code: 0,
    message: 'Token刷新成功',
    data: {
      token: 'new_mock_token_' + Date.now()
    }
  });
});

router.get('/captcha', authController.generateCaptcha);

export default router;