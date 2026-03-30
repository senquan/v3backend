import { Router } from "express";
import {
	getBotStatus,
	startBot,
	stopBot,
	getQrCode,
	getQrCodeText,
	restartBot
} from "../controllers/bot.controller";

const router = Router();

/**
 * 获取机器人状态
 * GET /api/bot/status
 */
router.get('/status', getBotStatus);

/**
 * 启动机器人
 * POST /api/bot/start
 */
router.post('/start', startBot);

/**
 * 停止机器人
 * POST /api/bot/stop
 */
router.post('/stop', stopBot);

/**
 * 获取当前二维码
 * GET /api/bot/qrcode
 */
router.get('/qrcode', getQrCode);

/**
 * 获取当前二维码（纯文本）
 * GET /api/bot/qrcode/text
 */
router.get('/qrcode/text', getQrCodeText);

/**
 * 重启机器人
 * POST /api/bot/restart
 */
router.post('/restart', restartBot);

export default router;