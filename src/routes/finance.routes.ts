import { Router, Response } from 'express';
import { FinanceController, ImportDepositController } from '../controllers/finance.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

const financeController = new FinanceController();
const importDepositController = new ImportDepositController();

// 应用认证中间件
router.use(authMiddleware);

router.get('/companies', (req, res: Response) => financeController.getCompanies(req, res));

router.get('/expenses', (req, res: Response) => financeController.getExpenses(req, res));

router.get('/payments', (req, res: Response) => financeController.getPayments(req, res));

router.get('/loan-deposit-summary', (req, res: Response) => financeController.getLoanDepositSummary(req, res));

router.get('/loan-deposit-summary/:id', (req, res: Response) => financeController.getLoanDepositSummaryById(req, res));

router.post('/import-deposit', (req, res: Response) => importDepositController.importDeposit(req, res));

router.get('/fixed-deposits', (req, res: Response) => importDepositController.getImportDepositRecords(req, res));

router.put('/import-deposit/:id/confirm', (req, res: Response) => importDepositController.confirmRecord(req, res));

router.put('/import-deposit/batch/confirm', (req, res: Response) => importDepositController.batchConfirm(req, res));

router.delete('/import-deposit/:id', (req, res: Response) => importDepositController.deleteRecord(req, res));

export default router;
