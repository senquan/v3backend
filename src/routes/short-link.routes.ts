import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { shortLinkController } from '../controllers/short-link.controller';

const router = Router();
const controller = shortLinkController;

/**
 * 短链接路由
 * 基础路径: /api/v1/short-link
 */

// 生成二维码图片（公开访问）
router.get('/qrcode/:code', controller.generateQRCode);

// 短链接重定向（公开访问，不需要认证）
router.get('/:code', controller.resolve);

// 需要认证的接口
router.use(authMiddleware);

// 生成短链接
router.post('/generate', controller.generate);

// 获取短链接详情
router.get('/:code', controller.getDetail);

// 获取短链接列表
router.get('/', controller.getList);

// 生成二维码（返回Base64）
router.get('/:code/qrcode/base64', controller.generateQRCodeBase64);

// 删除短链接
router.delete('/:code', controller.delete);

// 清理过期短链接
router.post('/clean/expired', controller.cleanExpired);

export default router;
