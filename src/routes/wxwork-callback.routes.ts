import { Router, Request, Response } from 'express';
import { wxWorkCallbackHandler } from '../bot/handlers/wxwork-callback.handler';
import { WxWorkBot } from '../bot/wxwork-bot';
import { expressTrackingService } from '../services/express-tracking.service';
import { successResponse, errorResponse } from '../utils/response';
import { logger } from '../utils/logger';

const router = Router();
const callbackHandler = wxWorkCallbackHandler;

// 企业微信回调接口（需要暴露给企业微信服务器）
router.get('/callback', async (req: Request, res: Response) => {
  await callbackHandler.verifyUrl(req, res);
});

router.post('/callback', async (req: Request, res: Response) => {
  await callbackHandler.handleCallback(req, res);
});

// 发送消息给用户（通过应用消息接口）
router.post('/send', async (req: Request, res: Response) => {
  try {
    const { toUser, content } = req.body;

    if (!content) {
      return errorResponse(res, 400, '消息内容不能为空');
    }

    const wxWorkConfig = {
      corpId: process.env.WXWORK_CORP_ID || '',
      corpSecret: process.env.WXWORK_CORP_SECRET || '',
      agentId: process.env.WXWORK_AGENT_ID || '',
      token: process.env.WXWORK_CALLBACK_TOKEN || '',
      encodingAesKey: process.env.WXWORK_ENCODING_AES_KEY || '',
    };

    const bot = new WxWorkBot(wxWorkConfig);
    const success = await bot.sendTextMessage(content, toUser);

    if (success) {
      return successResponse(res, null, '发送成功');
    } else {
      return errorResponse(res, 500, '发送失败');
    }
  } catch (error: any) {
    logger.error('发送企业微信消息失败:', error);
    return errorResponse(res, 500, error.message || '发送失败');
  }
});

// 发送卡片消息
router.post('/send/card', async (req: Request, res: Response) => {
  try {
    const { toUser, title, description, url, btnTxt } = req.body;

    if (!title || !description) {
      return errorResponse(res, 400, '标题和描述不能为空');
    }

    const wxWorkConfig = {
      corpId: process.env.WXWORK_CORP_ID || '',
      corpSecret: process.env.WXWORK_CORP_SECRET || '',
      agentId: process.env.WXWORK_AGENT_ID || '',
      token: process.env.WXWORK_CALLBACK_TOKEN || '',
      encodingAesKey: process.env.WXWORK_ENCODING_AES_KEY || '',
    };

    const bot = new WxWorkBot(wxWorkConfig);
    const success = await bot.sendTextCardMessage(title, description, url, btnTxt);

    if (success) {
      return successResponse(res, null, '发送成功');
    } else {
      return errorResponse(res, 500, '发送失败');
    }
  } catch (error: any) {
    logger.error('发送企业微信卡片消息失败:', error);
    return errorResponse(res, 500, error.message || '发送失败');
  }
});

// 群机器人发送消息（通过webhook）
router.post('/robot/send', async (req: Request, res: Response) => {
  try {
    const { webhookUrl, content } = req.body;

    if (!webhookUrl || !content) {
      return errorResponse(res, 400, 'webhook地址和内容不能为空');
    }

    const robot = new WxWorkBot(webhookUrl);
    const success = await robot.sendTextMessage(content);

    if (success) {
      return successResponse(res, null, '发送成功');
    } else {
      return errorResponse(res, 500, '发送失败');
    }
  } catch (error: any) {
    logger.error('发送群机器人消息失败:', error);
    return errorResponse(res, 500, error.message || '发送失败');
  }
});

// 发送快递状态更新通知到群
router.post('/notify/express-update', async (req: Request, res: Response) => {
  try {
    const { webhookUrl, trackingNumber, status, expressCompany } = req.body;

    if (!webhookUrl || !trackingNumber) {
      return errorResponse(res, 400, '参数不完整');
    }

    const statusText: Record<number, string> = {
      0: '待处理',
      1: '拦截中',
      2: '已退回',
      3: '已签收',
      4: '已确认',
      5: '超时待核实',
      6: '已入库',
      7: '理赔中',
      8: '已完结'
    };

    const content = `📦 **快递状态更新**
- 快递公司: ${expressCompany || '未知'}
- 单号: ${trackingNumber}
- 状态: ${statusText[status] || '未知'}`;

    const robot = new WxWorkBot(webhookUrl);
    const success = await robot.sendMarkdownMessage(content);

    if (success) {
      return successResponse(res, null, '发送成功');
    } else {
      return errorResponse(res, 500, '发送失败');
    }
  } catch (error: any) {
    logger.error('发送快递状态更新通知失败:', error);
    return errorResponse(res, 500, error.message || '发送失败');
  }
});

export default router;
