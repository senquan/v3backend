import { Router } from 'express';
import { TicketController } from '../controllers/ticket.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();
const ticketController = new TicketController();

// 工单基本操作
router.post('/', authMiddleware, ticketController.create);
router.get('/', authMiddleware, ticketController.getList);
router.get('/:id', authMiddleware, ticketController.getDetail);
router.put('/:id/assign', authMiddleware, ticketController.assign);
router.put('/:id/process', authMiddleware, ticketController.process);
router.put('/:id/confirm', authMiddleware, ticketController.confirm);
router.put('/:id/close', authMiddleware, ticketController.close);
router.put('/:id/cancel', authMiddleware, ticketController.cancel);

// 工单评论
router.post('/:id/comments', authMiddleware, ticketController.addComment);

// 工单附件
//router.post('/:id/attachments', authMiddleware, uploadMiddleware.single('file'), ticketController.uploadAttachment);

export default router;