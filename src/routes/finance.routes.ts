import { Router, Response } from 'express';
import { FinanceController, ImportDepositController } from '../controllers/finance.controller';
import { PaymentClearingController } from '../controllers/payment-clearing.controller';
import { FundTransferController } from '../controllers/fund-transfer.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

const financeController = new FinanceController();
const importDepositController = new ImportDepositController();
const paymentClearingController = new PaymentClearingController();
const fundTransferController = new FundTransferController();

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

// 到款清算管理
router.post('/import-receive', (req, res: Response) => paymentClearingController.importPaymentReceive(req, res));

router.get('/payment-receives', (req, res: Response) => paymentClearingController.getReceiveList(req, res));

router.put('/receive/:id', (req, res: Response) => paymentClearingController.updateReceive(req, res));

router.post('/receive/confirm', (req, res: Response) => paymentClearingController.confirmReceive(req, res));

router.delete('/receive', (req, res: Response) => paymentClearingController.deleteReceive(req, res));

// 资金上划下拨管理
router.post('/fund-transfer', (req, res: Response) => fundTransferController.createTransfer(req, res));

router.get('/fund-transfers', (req, res: Response) => fundTransferController.getTransferList(req, res));

router.put('/fund-transfer/:id', (req, res: Response) => fundTransferController.updateTransfer(req, res));

router.delete('/fund-transfer', (req, res: Response) => fundTransferController.deleteTransfer(req, res));

router.post('/fund-transfer/import', (req, res: Response) => fundTransferController.batchImport(req, res));

export default router;
