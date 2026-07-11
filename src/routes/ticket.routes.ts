import { Router } from 'express';
import { TicketController } from '../controllers/ticket.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();
const ticketController = new TicketController();

// 应用认证中间件
router.use(authMiddleware);

// 工单基本操作
router.post('/', ticketController.create);
router.get('/', ticketController.getList);
// 删除工单
router.delete('/:id', ticketController.delete);
router.get('/assignee', ticketController.getAssigneeList);
router.get('/department-tree', ticketController.getDepartmentUserTree);
router.get('/:id', ticketController.getDetail);
router.put('/:id', ticketController.update);
router.put('/:id/assign', ticketController.assign);
router.put('/:id/process', ticketController.process);
router.put('/:id/confirm', ticketController.confirm);
router.put('/:id/close', ticketController.close);
router.put('/:id/cancel', ticketController.cancel);

// 工单评论
router.post('/:id/comments', ticketController.addComment);

// 内部工单：收到确认 + 回复
router.put('/:id/receipt', ticketController.receipt);
router.post('/:id/reply', ticketController.reply);

// 部门工单确认进度
router.post('/:id/acknowledge', ticketController.acknowledgeReceipt);
router.get('/:id/confirmation-progress', ticketController.getConfirmationProgress);

// 工单附件
//router.post('/:id/attachments', uploadMiddleware.single('file'), ticketController.uploadAttachment);

export default router;