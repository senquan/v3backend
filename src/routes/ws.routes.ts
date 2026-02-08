import express from 'express';
import { sendNotification, getWebSocketStats } from '../controllers/ws.controller';

const router = express.Router();

// 发送通知
router.post('/notification', sendNotification);

// 获取WebSocket统计信息
router.get('/stats', getWebSocketStats);

export default router;