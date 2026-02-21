import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { CompanyController } from '../controllers/company.controller';
import { InterestRateController } from '../controllers/interest-rate.controller';

const router = Router();

const companyController = new CompanyController();
const interestRateController = new InterestRateController();

// 应用认证中间件
router.use(authMiddleware);

router.get('/companies', companyController.getAll);

router.get('/companies/tree', companyController.getTree);

router.get('/companies/parent/:parentId', companyController.getByParentId);

router.get('/companies/:id', companyController.getById);

router.post('/companies', companyController.create);

router.put('/companies/:id', companyController.update);

router.delete('/companies/:id', companyController.delete);

router.patch('/companies/:id/status', companyController.updateStatus);

// 利率管理

router.get('/interest-rate', interestRateController.getAll);

router.get('/interest-rate/:id', interestRateController.getById);

router.get('/interest-rate/type/:type', interestRateController.getByType);

router.post('/interest-rate', interestRateController.create);

router.post('/interest-rate/:id/confirm', interestRateController.confirmUpdate);

router.delete('/interest-rate/:id', interestRateController.delete);

export default router;
