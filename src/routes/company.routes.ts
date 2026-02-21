import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import companyController from '../controllers/company.controller';

const router = Router();

router.get('/companies', companyController.getAll);

router.get('/companies/tree', companyController.getTree);

router.get('/companies/parent/:parentId', companyController.getByParentId);

router.get('/companies/:id', companyController.getById);

router.post('/companies', authMiddleware, companyController.create);

router.put('/companies/:id', authMiddleware, companyController.update);

router.delete('/companies/:id', authMiddleware, companyController.delete);

router.patch('/companies/:id/status', authMiddleware, companyController.updateStatus);

export default router;
