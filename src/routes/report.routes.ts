import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { ClearingSummaryController } from '../controllers/clearing-summary.controller';
import { DepositLoanSummaryController } from '../controllers/deposit-loan-summary.controller';
import { InterestDetailController } from '../controllers/interest-detail.controller';

const router = Router();

const clearingSummaryController = new ClearingSummaryController();
const depositLoanSummaryController = new DepositLoanSummaryController();
const interestDetailController = new InterestDetailController();

router.use(authMiddleware);

router.get('/clearing-summary', clearingSummaryController.getAll);
router.get('/clearing-summary/:id', clearingSummaryController.getById);

router.get('/deposit-loan-summary', depositLoanSummaryController.getAll);
router.get('/deposit-loan-summary/:id', depositLoanSummaryController.getById);

router.get('/daily-interest', interestDetailController.getDailyInterest);
router.get('/daily-fixed-interest', interestDetailController.getDailyFixedInterest);
router.get('/fixed-to-current-interest', interestDetailController.getFixedToCurrentInterest);

export default router;
