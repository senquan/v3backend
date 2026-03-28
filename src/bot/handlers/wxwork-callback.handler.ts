import { Request, Response } from 'express';
import { TrackingRequestType } from '../../enums/express-tracking.enum'
import { WxWorkBot } from '../wxwork-bot';
import { MessagePatternMatcher } from './message-pattern.matcher';
import { ExpressTrackingService } from '../../services/express-tracking.service';
import { logger } from '../../utils/logger';

/**
 * 企业微信回调配置
 */
const wxWorkConfig = {
  corpId: process.env.WXWORK_CORP_ID || '',
  corpSecret: process.env.WXWORK_CORP_SECRET || '',
  agentId: process.env.WXWORK_AGENT_ID || '',
  token: process.env.WXWORK_CALLBACK_TOKEN || '',
  encodingAesKey: process.env.WXWORK_ENCODING_AES_KEY || '',
};

/**
 * 企业微信回调处理器
 */
export class WxWorkCallbackHandler {
  private bot: WxWorkBot;
  private matcher: MessagePatternMatcher;
  private trackingService: ExpressTrackingService;

  constructor() {
    this.bot = new WxWorkBot(wxWorkConfig);
    this.matcher = new MessagePatternMatcher();
    this.trackingService = new ExpressTrackingService();
  }

  /**
   * 处理回调验证URL（GET请求）
   * 企业微信会调用此接口验证URL
   */
  async verifyUrl(req: Request, res: Response): Promise<void> {
    const { msg_signature, timestamp, nonce, echostr } = req.query;

    if (!msg_signature || !timestamp || !nonce || !echostr) {
      res.status(400).send('参数错误');
      return;
    }

    try {
      // 生成签名进行验证
      const signature = this.bot.generateCallbackSignature(
        timestamp as string,
        nonce as string,
        echostr as string
      );

      // 验证签名
      if (signature !== msg_signature) {
        logger.warn('企业微信回调签名验证失败');
        res.status(403).send('签名验证失败');
        return;
      }

      // 解密echostr
      const decryptedEchostr = this.bot.decryptEchostr(echostr as string);

      // 返回解密后的echostr
      res.send(decryptedEchostr);
      logger.info('企业微信回调URL验证成功');
    } catch (error: any) {
      logger.error('验证回调URL失败:', error);
      res.status(500).send('验证失败');
    }
  }

  /**
   * 处理回调消息（POST请求）
   * 企业微信会将用户消息推送到此接口
   */
  async handleCallback(req: Request, res: Response): Promise<void> {
    const { msg_signature, timestamp, nonce } = req.query;

    // 解析XML内容
    const xmlContent = req.body;

    try {
      // 解析消息（支持加密和非加密模式）
      let message;
      if (xmlContent.Encrypt) {
        // 加密模式
        if (!msg_signature || !timestamp || !nonce) {
          res.status(400).send('参数错误');
          return;
        }

        message = await this.bot.parseCallbackMessage(JSON.stringify(xmlContent));
      } else {
        // 明文模式
        message = this.bot.parseMessage(xmlContent);
      }

      if (!message) {
        res.status(400).send('解析消息失败');
        return;
      }

      logger.info(`收到企业微信回调消息: ${JSON.stringify(message)}`);

      // 处理不同类型的消息
      const reply = await this.processMessage(message);

      // 返回成功（若需要回复消息，使用加密方式回复）
      res.send('success');

      // 如果有回复内容，发送被动响应
      if (reply) {
        await this.sendPassiveReply(message, reply);
      }
    } catch (error: any) {
      logger.error('处理回调消息失败:', error);
      res.status(500).send('处理失败');
    }
  }

  /**
   * 处理接收到的消息
   */
  private async processMessage(message: any): Promise<string | null> {
    const content = message.content?.trim() || '';

    if (!content) {
      return null;
    }

    // 解析消息类型
    const parsed = this.matcher.match(content);

    switch (parsed.type) {
      case 'INTERCEPTION_REQUEST':
        return await this.handleInterceptionRequest(parsed);
      case 'INTERCEPTION_SUCCESS':
        return await this.handleInterceptionSuccess(parsed);
      case 'INTERCEPTION_FAILED':
        return await this.handleInterceptionFailed(parsed);
      case 'REJECT':
        return await this.handleReject(parsed);
      case 'NOT_RECEIVED':
        return await this.handleNotReceived(parsed);
      case 'ADDRESS_ISSUE':
        return await this.handleAddressIssue(parsed);
      case 'DAMAGE':
        return await this.handleDamage(parsed);
      case 'LOST':
        return await this.handleLost(parsed);
      case 'HELLO':
        return `👋 你好！我是快递处理助手，可以帮你登记和处理快递问题。\n\n输入"帮助"查看支持的功能。`;
      case 'HELP':
        return this.getHelpText();
      default:
        return null;
    }
  }

  /**
   * 处理拦截请求
   */
  private async handleInterceptionRequest(parsed: any): Promise<string> {
    const { expressCompany, trackingNumber } = parsed;

    if (!trackingNumber) {
      return '❌ 格式错误，请使用：拦截快递：快递公司+单号\n例如：拦截快递：韵达123456789';
    }

    try {
      // 查找快递公司ID（需要先在数据库中创建快递公司数据）
      const expressCompanyId = await this.findExpressCompanyId(expressCompany);

      const record = await this.trackingService.createInterception({
        trackingNumber,
        requestType: TrackingRequestType.INTERCEPTION,
        expressCompanyId,
        requestReason: '企业微信拦截请求'
      });

      return `✅ 拦截请求已记录\n📦 单号: ${trackingNumber}\n📋 状态: 待处理\n🆔 记录ID: ${record.id}`;
    } catch (error: any) {
      logger.error('创建拦截记录失败:', error);
      return `❌ 创建拦截记录失败: ${error.message}`;
    }
  }

  /**
   * 处理拦截成功
   */
  private async handleInterceptionSuccess(parsed: any): Promise<string> {
    const { trackingNumber } = parsed;

    if (!trackingNumber) {
      return '⚠️ 未检测到快递单号';
    }

    try {
      const record = await this.trackingService.findByTrackingNumber(trackingNumber);

      if (!record) {
        return `⚠️ 未找到单号 ${trackingNumber} 的记录`;
      }

      await this.trackingService.updateStatus(record.id, {
        status: 2, // RETURNED状态
        remarks: '企业微信确认已退回'
      });

      return `✅ 单号 ${trackingNumber} 已标记为已退回`;
    } catch (error: any) {
      logger.error('更新状态失败:', error);
      return `❌ 更新状态失败: ${error.message}`;
    }
  }

  /**
   * 处理拦截失败（已签收）
   */
  private async handleInterceptionFailed(parsed: any): Promise<string> {
    const { trackingNumber } = parsed;

    if (!trackingNumber) {
      return '⚠️ 未检测到快递单号';
    }

    try {
      const record = await this.trackingService.findByTrackingNumber(trackingNumber);

      if (!record) {
        return `⚠️ 未找到单号 ${trackingNumber} 的记录`;
      }

      await this.trackingService.updateStatus(record.id, {
        status: 3, // SIGNED状态
        remarks: '企业微信确认已签收'
      });

      return `✅ 单号 ${trackingNumber} 已标记为已签收`;
    } catch (error: any) {
      logger.error('更新状态失败:', error);
      return `❌ 更新状态失败: ${error.message}`;
    }
  }

  /**
   * 处理拒收
   */
  private async handleReject(parsed: any): Promise<string> {
    const { trackingNumber, reason } = parsed;

    if (!trackingNumber) {
      return '❌ 格式错误，请使用：拒收+单号\n例如：拒收123456789';
    }

    try {
      const expressCompanyId = await this.findExpressCompanyId('未知');

      await this.trackingService.createInterception({
        trackingNumber,
        requestType: TrackingRequestType.REJECT,
        expressCompanyId,
        requestReason: reason || '买家拒收'
      });

      return `✅ 拒收记录已创建\n🆔 单号: ${trackingNumber}`;
    } catch (error: any) {
      logger.error('创建拒收记录失败:', error);
      return `❌ 创建记录失败: ${error.message}`;
    }
  }

  /**
   * 处理未收到
   */
  private async handleNotReceived(parsed: any): Promise<string> {
    const { trackingNumber } = parsed;

    if (!trackingNumber) {
      return '❌ 格式错误，请使用：未收到+单号\n例如：未收到123456789';
    }

    try {
      const expressCompanyId = await this.findExpressCompanyId('未知');

      await this.trackingService.createInterception({
        trackingNumber,
        requestType: TrackingRequestType.NO_RECEIVE,
        expressCompanyId,
        requestReason: '买家未收到货'
      });

      return `✅ 未收到记录已创建\n🆔 单号: ${trackingNumber}`;
    } catch (error: any) {
      logger.error('创建未收到记录失败:', error);
      return `❌ 创建记录失败: ${error.message}`;
    }
  }

  /**
   * 处理地址异常
   */
  private async handleAddressIssue(parsed: any): Promise<string> {
    const { trackingNumber, reason } = parsed;

    if (!trackingNumber) {
      return '❌ 格式错误，请使用：地址异常+单号\n例如：地址异常123456789';
    }

    try {
      const expressCompanyId = await this.findExpressCompanyId('未知');

      await this.trackingService.createInterception({
        trackingNumber,
        requestType: TrackingRequestType.ADDR_ISSUE,
        expressCompanyId,
        requestReason: reason || '地址异常/电话不通'
      });

      return `✅ 地址异常记录已创建\n🆔 单号: ${trackingNumber}`;
    } catch (error: any) {
      logger.error('创建地址异常记录失败:', error);
      return `❌ 创建记录失败: ${error.message}`;
    }
  }

  /**
   * 处理破损
   */
  private async handleDamage(parsed: any): Promise<string> {
    const { trackingNumber } = parsed;

    if (!trackingNumber) {
      return '❌ 格式错误，请使用：破损+单号\n例如：破损123456789';
    }

    try {
      const expressCompanyId = await this.findExpressCompanyId('未知');

      await this.trackingService.createInterception({
        trackingNumber,
        requestType: TrackingRequestType.DAMAGE,
        expressCompanyId,
        requestReason: '外包装破损'
      });

      return `✅ 破损记录已创建\n🆔 单号: ${trackingNumber}`;
    } catch (error: any) {
      logger.error('创建破损记录失败:', error);
      return `❌ 创建记录失败: ${error.message}`;
    }
  }

  /**
   * 处理丢件
   */
  private async handleLost(parsed: any): Promise<string> {
    const { trackingNumber } = parsed;

    if (!trackingNumber) {
      return '❌ 格式错误，请使用：丢件+单号\n例如：丢件123456789';
    }

    try {
      const expressCompanyId = await this.findExpressCompanyId('未知');

      await this.trackingService.createInterception({
        trackingNumber,
        requestType: TrackingRequestType.LOST,
        expressCompanyId,
        requestReason: '长期无物流，疑似丢件'
      });

      return `✅ 丢件记录已创建\n🆔 单号: ${trackingNumber}`;
    } catch (error: any) {
      logger.error('创建丢件记录失败:', error);
      return `❌ 创建记录失败: ${error.message}`;
    }
  }

  /**
   * 获取帮助文本
   */
  private getHelpText(): string {
    return `📖 **快递处理助手使用指南**

**拦截请求**
格式：拦截快递：快递公司+单号
示例：拦截快递：韵达123456789

**其他问题登记**
• 拒收+单号，如：拒收123456789
• 未收到+单号，如：未收到123456789
• 地址异常+单号，如：地址异常123456789
• 破损+单号，如：破损123456789
• 丢件+单号，如：丢件123456789

**拦截结果确认**
• 已拦截/已退回 - 标记为已退回
• 已签收/无法拦截 - 标记为已签收`;
  }

  /**
   * 发送被动回复消息
   */
  private async sendPassiveReply(message: any, content: string): Promise<void> {
    try {
      // 企业微信被动响应需要将消息加密后返回
      // 这里简化处理，实际生产环境需要加密
      logger.info(`回复消息: ${content}`);
    } catch (error: any) {
      logger.error('发送被动回复失败:', error);
    }
  }

  /**
   * 根据快递公司名称查找ID
   */
  private async findExpressCompanyId(companyName: string): Promise<number> {
    // 这里应该查询数据库获取快递公司ID
    // 暂时返回一个默认值1，实际使用时需要完善
    return 1;
  }
}

// 导出单例
export const wxWorkCallbackHandler = new WxWorkCallbackHandler();
