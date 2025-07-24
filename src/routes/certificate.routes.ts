import { Router } from 'express';
import { CertificateController } from '../controllers/certificate.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();
const certificateController = new CertificateController();

// 应用认证中间件
router.use(authMiddleware);

// 获取证书模板列表
router.get('/', certificateController.getList.bind(certificateController));

// 获取证书模板详情
router.get('/:id', certificateController.getDetail.bind(certificateController));

// 创建证书模板
router.post('/', certificateController.create.bind(certificateController));

// 更新证书模板
router.put('/:id', certificateController.update.bind(certificateController));

// 删除证书模板
router.delete('/:id', certificateController.delete.bind(certificateController));

// 批量删除证书模板
router.post('/batch-delete', certificateController.batchDelete.bind(certificateController));

// 获取证书类型选项
router.get('/options/certificate-types', certificateController.getCertificateTypes.bind(certificateController));

// 颁发证书
router.post('/issue', certificateController.issue.bind(certificateController));

export default router;