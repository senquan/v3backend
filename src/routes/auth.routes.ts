import { Router, Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';

const router = Router();
const authController = require('../controllers/auth.controller');

// 登录路由
router.post('/login',(req: Request, res: Response) => {

  const token = jwt.sign(
    { id: 1 },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '24h' }
  );

  res.json({
    code: 0,
    message: '登入成功',
    data: {
      token,
      user: {
        id: 1,
        username: "admin",
        name: "管理员",
        email: "admin@sample.com ",
        avatar: "",
        roles: [
          "ADMIN"
        ]
      }
    }
  });
});

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