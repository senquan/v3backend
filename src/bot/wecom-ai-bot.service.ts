import AiBot, {
  WSClient,
  WsFrame,
  TextMessage,
  generateReqId,
  EventMessage
} from '@wecom/aibot-node-sdk';
import { ExpressTrackingService } from '../services/express-tracking.service';
import { TrackingRequestType } from '../enums/express-tracking.enum';
import { logger } from '../utils/logger';
import { identifyLogisticsCompany } from '../utils/express-tracking';


/**
 * 企业微信AI机器人服务 - 长连接接入
 * 使用 @wecom/aibot-node-sdk 实现长连接消息接收与处理
 */
export class WeComAiBotService {
  private static instance: WeComAiBotService;
  private bot: WSClient | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private readonly reconnectDelay = 5000; // 5秒重连延迟
  

  private constructor(private readonly expressTrackingService: ExpressTrackingService) {}

  static getInstance(): WeComAiBotService {
    if (!WeComAiBotService.instance) {
      WeComAiBotService.instance = new WeComAiBotService(new ExpressTrackingService());
    }
    return WeComAiBotService.instance;
  }

  /**
   * 初始化机器人
   */
  async initialize(): Promise<void> {
    try {
      const botId = process.env.WXWORK_BOT_ID;
      const botSecret = process.env.WXWORK_BOT_SECRET;

      if (!botId || !botSecret) {
        logger.warn('企业微信机器人Token或Secret未配置，跳过初始化');
        return;
      }

      logger.info('正在初始化企业微信AI机器人...');

      // 创建机器人实例
      this.bot = new AiBot.WSClient({
        botId: botId,
        secret: botSecret,
        maxReconnectAttempts: 5,
        maxAuthFailureAttempts: 5,
        reconnectInterval: 5000,
        logger: {
          debug: (msg, ...args) => logger.debug(msg, ...args),
          info: (msg, ...args) => logger.info(msg, ...args),
          warn: (msg, ...args) => logger.warn(msg, ...args),
          error: (msg, ...args) => logger.error(msg, ...args)
        }
      });

      // 设置事件监听
      this.setupEventListeners();

      // 启动长连接（connect返回this，支持链式调用）
      this.bot.connect();

      logger.info('企业微信AI机器人长连接服务已启动');
    } catch (error: any) {
      logger.error('企业微信AI机器人初始化失败:', error.message);

      // 自动重连
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        logger.info(`尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

        setTimeout(() => {
          this.initialize();
        }, this.reconnectDelay * this.reconnectAttempts);
      } else {
        logger.error('达到最大重连次数，停止重连');
      }
    }
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    if (!this.bot) return;

    // 监听连接成功事件
    this.bot.on('connected', () => {
      logger.info('企业微信机器人连接成功');
      this.isConnected = true;
      this.reconnectAttempts = 0;
    });

    // 监听认证成功事件
    this.bot.on('authenticated', () => {
      logger.info('企业微信机器人认证成功');
    });

    // 监听断开连接事件
    this.bot.on('disconnected', (reason: string) => {
      logger.warn(`企业微信机器人连接已断开: ${reason}`);
      this.isConnected = false;
    });

    // 监听重连事件
    this.bot.on('reconnecting', (attempt: number) => {
      logger.info(`企业微信机器人正在重连，第 ${attempt} 次尝试`);
    });

    // 监听错误事件
    this.bot.on('error', (error: Error) => {
      logger.error('企业微信机器人错误:', error.message);
    });

    // 监听文本消息
    this.bot.on('message.text', async (frame: WsFrame<TextMessage>) => {
      await this.handleTextMessage(frame);
    });

    // 监听图片消息
    this.bot.on('message.image', async (frame: WsFrame) => {
      await this.handleImageMessage(frame);
    });

    // 监听图文混排消息
    this.bot.on('message.mixed', async (frame: WsFrame) => {
      await this.handleMixedMessage(frame);
    });

    // 监听语音消息
    this.bot.on('message.voice', async (frame: WsFrame) => {
      await this.handleVoiceMessage(frame);
    });

    // 监听文件消息
    this.bot.on('message.file', async (frame: WsFrame) => {
      await this.handleFileMessage(frame);
    });

    // 监听事件回调
    this.bot.on('event', async (frame: WsFrame<EventMessage>) => {
      await this.handleEvent(frame);
    });

    // 监听进入会话事件
    this.bot.on('event.enter_chat', async (frame: WsFrame<EventMessage>) => {
      await this.handleEnterChatEvent(frame);
    });
  }

  /**
   * 处理文本消息
   */
  private async handleTextMessage(frame: WsFrame<TextMessage>): Promise<void> {
    const message = frame.body;
    if (!message) return;

    const content = message.text?.content || '';
    const from = message.from?.userid || '';
    const streamId = generateReqId('stream');

    logger.info(`收到文本消息: ${content}, 来自: ${from}`);

    try {
      // 发送流式回复开始
      if (this.bot) {
        await this.bot.replyStream(frame, streamId, '正在处理中...', false);
      }

      // 解析消息内容
      const parsed = this.parseMessageContent(content);

			console.log(parsed);

      // 根据消息类型处理
      let responseText = '收到您的消息，正在处理中...';

      if (parsed.type === 'intercept') {
        responseText = await this.handleInterception(parsed.data, from);
      } else if (parsed.type === 'reject') {
        responseText = await this.handleReject(parsed.data, from);
      } else if (parsed.type === 'damage') {
        responseText = await this.handleDamage(parsed.data, from);
      } else if (parsed.type === 'lost') {
        responseText = await this.handleLost(parsed.data, from);
      } else if (parsed.type === 'address_issue') {
        responseText = await this.handleAddressIssue(parsed.data, from);
      } else {
        responseText = this.getHelpText();
      }

      // 发送流式回复结束
      if (this.bot) {
        await this.bot.replyStream(frame, streamId, responseText, true);
      }
    } catch (error: any) {
      logger.error('处理文本消息失败:', error.message);

      if (this.bot) {
        await this.bot.replyStream(frame, streamId, '处理消息时出错，请稍后重试', true);
      }
    }
  }

  /**
   * 处理图片消息
   */
  private async handleImageMessage(frame: WsFrame): Promise<void> {
    const message = frame.body;
    const from = message.from?.userid || '';
    const imageUrl = message.image?.url || '';
    const aesKey = message.image?.aeskey;

    logger.info(`收到图片消息: ${imageUrl}, 来自: ${from}`);

    try {
      // TODO: 下载并处理图片
      if (aesKey && this.bot) {
        const { buffer } = await this.bot.downloadFile(imageUrl, aesKey);
        logger.info(`图片下载成功，大小: ${buffer.length} bytes`);
      }

      if (this.bot) {
        await this.bot.replyStream(frame, generateReqId('stream'), '收到您的图片，正在处理中...', true);
      }
    } catch (error: any) {
      logger.error('处理图片消息失败:', error.message);
    }
  }

  /**
   * 处理图文混排消息
   */
  private async handleMixedMessage(frame: WsFrame): Promise<void> {
    const message = frame.body;
    const from = message.from?.userid || '';

    logger.info(`收到图文混排消息，来自: ${from}`);

    if (this.bot) {
      await this.bot.replyStream(frame, generateReqId('stream'), '收到您的消息，正在处理中...', true);
    }
  }

  /**
   * 处理语音消息
   */
  private async handleVoiceMessage(frame: WsFrame): Promise<void> {
    const message = frame.body;
    const from = message.from?.userid || '';
    const content = message.voice?.content || '';

    logger.info(`收到语音消息: ${content}, 来自: ${from}`);

    if (this.bot) {
      await this.bot.replyStream(frame, generateReqId('stream'), '收到您的语音，正在处理中...', true);
    }
  }

  /**
   * 处理文件消息
   */
  private async handleFileMessage(frame: WsFrame): Promise<void> {
    const message = frame.body;
    const from = message.from?.userid || '';
    const fileUrl = message.file?.url || '';
    const aesKey = message.file?.aeskey;

    logger.info(`收到文件消息: ${fileUrl}, 来自: ${from}`);

    try {
      // TODO: 下载并处理文件
      if (aesKey && this.bot) {
        const { buffer, filename } = await this.bot.downloadFile(fileUrl, aesKey);
        logger.info(`文件下载成功: ${filename}, 大小: ${buffer.length} bytes`);
      }

      if (this.bot) {
        await this.bot.replyStream(frame, generateReqId('stream'), '收到您的文件，正在处理中...', true);
      }
    } catch (error: any) {
      logger.error('处理文件消息失败:', error.message);
    }
  }

  /**
   * 处理事件消息
   */
  private async handleEvent(frame: WsFrame<EventMessage>): Promise<void> {
    const event = frame.body;
    if (!event) return;

    const eventType = event.event?.eventtype;
    const from = event.from?.userid || '';

    logger.info(`收到事件消息: ${eventType}, 来自: ${from}`);

    // 事件由专用监听器处理
  }

  /**
   * 处理进入会话事件
   */
  private async handleEnterChatEvent(frame: WsFrame<EventMessage>): Promise<void> {
    const event = frame.body;
    if (!event) return;

    const from = event.from?.userid || '';

    logger.info(`用户进入会话: ${from}`);

    // 发送欢迎语
    const welcomeText = this.getWelcomeText();

    if (this.bot) {
      await this.bot.replyWelcome(frame, {
        msgtype: 'text',
        text: { content: welcomeText }
      });
    }
  }

  /**
   * 获取帮助文本
   */
  private getHelpText(): string {
    return `
欢迎使用快递管理助手！

您可以发送以下指令：
1. 拦截 [快递单号] [快递公司] - 拦截快递
2. 拒收 [快递单号] [快递公司] - 拒收快递
3. 损坏 [快递单号] [快递公司] - 快递损坏
4. 丢失 [快递单号] [快递公司] - 快递丢失
5. 地址 [快递单号] [快递公司] - 地址问题

例如：
拦截 SF1234567890 顺丰
拒收 JD1234567890 京东
    `.trim();
  }

  /**
   * 获取欢迎语文本
   */
  private getWelcomeText(): string {
    return `👋 欢迎使用快递管理助手！

${this.getHelpText()}`;
  }

  /**
   * 处理快递拦截
   */
  private async handleInterception(data: any, userId: string): Promise<string> {
    const { trackingNumber, expressCompany } = data;
    logger.info(`拦截快递: ${trackingNumber}, ${expressCompany}`);

    // 调用快递拦截服务
    await this.expressTrackingService.createInterception({ trackingNumber, expressCompanyName: expressCompany, requestType: TrackingRequestType.INTERCEPTION });

    return `✅ 已收到拦截请求：

📦 快递单号：${trackingNumber}
🚚 快递公司：${expressCompany}

正在处理中，请稍候...`;
  }

  /**
   * 处理快递拒收
   */
  private async handleReject(data: any, userId: string): Promise<string> {
    const { trackingNumber, expressCompany } = data;
    logger.info(`拒收快递: ${trackingNumber}, ${expressCompany}`);

    // TODO: 调用快递拒收服务
    // await expressTrackingService.createReject(trackingNumber, expressCompany, userId);

    return `✅ 已收到拒收请求：

📦 快递单号：${trackingNumber}
🚚 快递公司：${expressCompany}

正在处理中，请稍候...`;
  }

  /**
   * 处理快递损坏
   */
  private async handleDamage(data: any, userId: string): Promise<string> {
    const { trackingNumber, expressCompany } = data;
    logger.info(`快递损坏: ${trackingNumber}, ${expressCompany}`);

    // TODO: 调用快递损坏处理服务
    // await expressTrackingService.createDamage(trackingNumber, expressCompany, userId);

    return `✅ 已收到损坏报告：

📦 快递单号：${trackingNumber}
🚚 快递公司：${expressCompany}

正在处理中，请稍候...`;
  }

  /**
   * 处理快递丢失
   */
  private async handleLost(data: any, userId: string): Promise<string> {
    const { trackingNumber, expressCompany } = data;
    logger.info(`快递丢失: ${trackingNumber}, ${expressCompany}`);

    // TODO: 调用快递丢失处理服务
    // await expressTrackingService.createLost(trackingNumber, expressCompany, userId);

    return `✅ 已收到丢失报告：

📦 快递单号：${trackingNumber}
🚚 快递公司：${expressCompany}

正在处理中，请稍候...`;
  }

  /**
   * 处理地址问题
   */
  private async handleAddressIssue(data: any, userId: string): Promise<string> {
    const { trackingNumber, expressCompany } = data;
    logger.info(`地址问题: ${trackingNumber}, ${expressCompany}`);

    // TODO: 调用地址问题处理服务
    // await expressTrackingService.createAddressIssue(trackingNumber, expressCompany, userId);

    return `✅ 已收到地址问题报告：

📦 快递单号：${trackingNumber}
🚚 快递公司：${expressCompany}

正在处理中，请稍候...`;
  }

  /**
   * 解析消息内容
   */
  private parseMessageContent(content: string): {
    type: string;
    data: any;
  } {
    // 支持多种格式：
    // 拦截 SF1234567890 顺丰
    // 拒收 SF1234567890
    // 损坏 SF1234567890
    // 丢失 SF1234567890
    // 地址 SF1234567890

    const patterns = [
      /^(拦截|intercept)\s+(\S+)(?:\s+(\S^@+))?/i,
      /^(拒收|reject)\s+(\S+)(?:\s+(\S^@+))?/i,
      /^(损坏|damage)\s+(\S+)(?:\s+(\S^@+))?/i,
      /^(丢失|lost)\s+(\S+)(?:\s+(\S^@+))?/i,
      /^(地址|address)\s+(\S+)(?:\s+(\S^@+))?/i,
      /^(帮助|help)?$/i,
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        const [, type, trackingNumber, expressCompany] = match;
        return {
          type: this.getMessageType(type.toLowerCase()),
          data: {
            trackingNumber,
            expressCompany: expressCompany || identifyLogisticsCompany(trackingNumber) || '未知',
          },
        };
      }
    }

    return {
      type: 'unknown',
      data: null,
    };
  }

  /**
   * 主动发送文本消息
   */
  async sendText(chatid: string, content: string): Promise<boolean> {
    if (!this.bot || !this.isConnected) {
      logger.warn('机器人未连接，无法发送消息');
      return false;
    }

    try {
      await this.bot.sendMessage(chatid, {
        msgtype: 'markdown',
        markdown: {
          content
        }
      });
      return true;
    } catch (error: any) {
      logger.error('发送文本消息失败:', error.message);
      return false;
    }
  }

  getMessageType(type: string): string {
    switch (type) {
      case '拦截':
      case 'intercept':
        return 'intercept';
			case '拒收':
      case 'reject':
        return 'reject';
			case '损坏':
      case 'damage':
        return 'damage';
			case '丢失':
      case 'lost':
        return 'lost';
			case '地址':
      case 'address':
        return 'address';
      default:
        return 'unknown';
    }
  }

  /**
   * 获取连接状态
   */
  getConnectionStatus(): boolean {
    return this.isConnected || (this.bot?.isConnected ?? false);
  }

  /**
   * 获取机器人实例
   */
  getBot(): WSClient | null {
    return this.bot;
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    if (this.bot) {
      this.bot.disconnect();
      this.bot = null;
      this.isConnected = false;
      logger.info('企业微信机器人已断开连接');
    }
  }
}

// 导出单例
export const wecomAiBotService = WeComAiBotService.getInstance();
