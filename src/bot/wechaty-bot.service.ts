import { WechatyBuilder, ScanStatus } from 'wechaty';
import { logger } from '../utils/logger';

export interface WechatyBotOptions {
  name?: string;
  puppet?: string;
  puppetOptions?: any;
}

/**
 * Wechaty Bot 封装类
 */
export class WechatyBot {
  private bot: any;
  private isRunning: boolean = false;
  private eventCallbacks: Map<string, Function[]> = new Map();

  constructor(options: WechatyBotOptions = {}) {
    const { name = 'ExpressBot', puppet = 'wechaty-puppet-wechat', puppetOptions = {} } = options;

    this.bot = WechatyBuilder.build({
      name,
      puppet: puppet as any,
      puppetOptions: puppetOptions as any,
    });

    this.setupEventHandlers();
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    // 扫码登录事件
    this.bot.on('scan', (qrcode: string, status: ScanStatus) => {
      const qrcodeImageUrl = [
        'https://api.qrserver.com/v1/create-qr-code/?data=',
        encodeURIComponent(qrcode),
      ].join('');

      logger.info(`扫码登录: ${qrcodeImageUrl}, status: ${status}`);
      console.log('请扫描二维码登录:', qrcodeImageUrl);

      // 触发自定义回调（所有状态都触发）
      this.emit('scan', qrcode, status);
    });

    // 登录成功事件
    this.bot.on('login', (user: any) => {
      logger.info(`BOT登录成功: ${user.name()}`);
      this.isRunning = true;

      // 触发自定义回调
      this.emit('login', user);
    });

    // 登出事件
    this.bot.on('logout', (user: any) => {
      logger.info(`BOT已登出: ${user.name()}`);
      this.isRunning = false;

      // 触发自定义回调
      this.emit('logout', user);
    });

    // 消息事件
    this.bot.on('message', (msg: any) => {
      logger.debug(`收到消息: ${msg.type()} - ${msg.text()}`);

      // 触发自定义回调
      this.emit('message', msg);
    });

    // 错误事件
    this.bot.on('error', (err: any) => {
      logger.error('BOT错误:', err);

      // 触发自定义回调
      this.emit('error', err);
    });

    // 私聊消息事件
    this.bot.on('friendship', (friendship: any) => {
      logger.info(`收到好友请求: ${friendship.hello()}`);

      // 触发自定义回调
      this.emit('friendship', friendship);
    });

    // 群聊变动事件
    this.bot.on('room-join', (room: any, _inviteeList: any, _inviter: any) => {
      logger.info(`新成员加入群聊: ${room.topic()}`);

      // 触发自定义回调
      this.emit('room-join', room, _inviteeList, _inviter);
    });

    this.bot.on('room-leave', (room: any, _leaverList: any, _remover: any) => {
      logger.info(`成员离开群聊: ${room.topic()}`);

      // 触发自定义回调
      this.emit('room-leave', room, _leaverList, _remover);
    });
  }

  /**
   * 注册事件监听器
   * @param event 事件名称
   * @param callback 回调函数
   */
  on(event: string, callback: Function): void {
    if (!this.eventCallbacks.has(event)) {
      this.eventCallbacks.set(event, []);
    }
    this.eventCallbacks.get(event)!.push(callback);
  }

  /**
   * 移除事件监听器
   * @param event 事件名称
   * @param callback 回调函数
   */
  off(event: string, callback: Function): void {
    const callbacks = this.eventCallbacks.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * 触发事件
   * @param event 事件名称
   * @param args 事件参数
   */
  private emit(event: string, ...args: any[]): void {
    const callbacks = this.eventCallbacks.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          logger.error(`事件回调执行失败 [${event}]:`, error);
        }
      });
    }
  }

  /**
   * 启动BOT
   */
  async start(): Promise<void> {
    try {
      await this.bot.start();
      logger.info('Wechaty BOT 已启动');
    } catch (error) {
      logger.error('启动BOT失败:', error);
      throw error;
    }
  }

  /**
   * 停止BOT
   */
  async stop(): Promise<void> {
    try {
      await this.bot.stop();
      this.isRunning = false;
      logger.info('Wechaty BOT 已停止');
    } catch (error) {
      logger.error('停止BOT失败:', error);
      throw error;
    }
  }

  /**
   * 获取当前登录用户
   */
  getCurrentUser() {
    try {
      return this.bot.currentUser;
    } catch (error) {
      // 如果还未登录，currentUser getter 会抛出错误
      return null;
    }
  }

  /**
   * 检查BOT是否运行中
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * 发送消息到指定房间
   */
  async sendRoomMessage(roomId: string, message: string): Promise<void> {
    const room = await this.bot.Room.find({ id: roomId });
    if (room) {
      await room.say(message);
      logger.info(`发送消息到群聊 ${roomId}: ${message}`);
    } else {
      logger.warn(`未找到群聊: ${roomId}`);
    }
  }

  /**
   * 发送消息到指定联系人
   */
  async sendDirectMessage(contactId: string, message: string): Promise<void> {
    const contact = await this.bot.Contact.find({ id: contactId });
    if (contact) {
      await contact.say(message);
      logger.info(`发送消息给 ${contactId}: ${message}`);
    } else {
      logger.warn(`未找到联系人: ${contactId}`);
    }
  }
}
