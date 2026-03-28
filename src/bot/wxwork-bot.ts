import axios from 'axios';
import crypto from 'crypto';
import xml2js from 'xml2js';
import { logger } from '../utils/logger';

/**
 * 企业微信应用配置
 */
export interface WxWorkConfig {
  corpId: string;          // 企业ID
  corpSecret: string;      // 应用密钥
  agentId: string;         // 应用AgentID
  token: string;           // 回调Token
  encodingAesKey: string;  // 回调EncodingAESKey
}

/**
 * 企业微信消息接口
 */
export interface WxWorkMessage {
  touser?: string;         // 成员ID列表（多个用|分隔）
  toparty?: string;        // 部门ID列表
  totag?: string;          // 标签ID列表
  msgtype: string;         // 消息类型
  agentid: string;         // 应用AgentID
  content?: string;         // 文本消息内容
  media_id?: string;       // 媒体文件ID
  title?: string;          // 消息标题
  description?: string;    // 消息描述
  url?: string;            // 链接消息URL
  picurl?: string;         // 图片消息URL
  btn_txt?: string;        // 按钮文本
}

/**
 * 回调消息结构
 */
export interface CallbackMessage {
  msgType: string;
  content: string;
  fromUserName: string;
  toUserName: string;
  createTime: string;
  event?: string;
  eventKey?: string;
  ticket?: string;
  latitude?: string;
  longitude?: string;
  precision?: string;
}

/**
 * 企业微信机器人配置
 */
export interface WxWorkRobotConfig {
  webhookUrl: string;  // 群机器人Webhook地址
}

/**
 * 企业微信API服务
 * 基于企业微信原生API实现消息发送和接收
 */
export class WxWorkBot {
  private config: WxWorkConfig;
  private accessToken: string | null = null;
  private tokenExpireTime: number = 0;

  constructor(config: WxWorkConfig) {
    this.config = config;
  }

  /**
   * 获取access_token
   */
  async getAccessToken(): Promise<string> {
    // 如果token未过期，直接返回
    if (this.accessToken && Date.now() < this.tokenExpireTime) {
      return this.accessToken;
    }

    const url = `https://qyapi.weixin.qq.com/cgi-bin/gettoken`;
    const params = {
      corpid: this.config.corpId,
      corpsecret: this.config.corpSecret
    };

    try {
      const response = await axios.get(url, { params });
      const data = response.data;

      if (data.errcode !== 0) {
        throw new Error(`获取access_token失败: ${data.errmsg}`);
      }

      this.accessToken = data.access_token;
      // 提前5分钟过期
      this.tokenExpireTime = Date.now() + (data.expires_in - 300) * 1000;

      logger.info('获取access_token成功');
      return this.accessToken!;
    } catch (error: any) {
      logger.error('获取access_token失败:', error.message);
      throw error;
    }
  }

  /**
   * 发送应用消息
   */
  async sendMessage(message: WxWorkMessage): Promise<boolean> {
    const token = await this.getAccessToken();
    const url = `https://qyapi.weixin.qq.com/cgi-bin/message/send`;

    try {
      const response = await axios.post(
        `${url}?access_token=${token}`,
        {
          ...message,
          agentid: this.config.agentId
        }
      );

      const data = response.data;

      if (data.errcode !== 0) {
        logger.error(`发送消息失败: ${data.errmsg}`);
        return false;
      }

      logger.info(`发送消息成功`);
      return true;
    } catch (error: any) {
      logger.error('发送消息异常:', error.message);
      return false;
    }
  }

  /**
   * 发送文本消息
   */
  async sendTextMessage(content: string, toUser?: string): Promise<boolean> {
    return this.sendMessage({
      msgtype: 'text',
      agentid: this.config.agentId,
      touser: toUser,
      content
    });
  }

  /**
   * 发送卡片消息
   */
  async sendTextCardMessage(title: string, description: string, url?: string, btnTxt?: string): Promise<boolean> {
    return this.sendMessage({
      msgtype: 'textcard',
      agentid: this.config.agentId,
      title,
      description,
      url,
      btn_txt: btnTxt
    });
  }

  /**
   * 发送markdown消息
   */
  async sendMarkdownMessage(content: string): Promise<boolean> {
    return this.sendMessage({
      msgtype: 'markdown',
      agentid: this.config.agentId,
      content
    });
  }

  /**
   * 验证回调签名
   */
  verifyCallbackSignature(msgSignature: string, timestamp: string, nonce: string, encryptedMsg: string): boolean {
    const sortArr = [this.config.token, timestamp, nonce, encryptedMsg].sort();
    const signature = crypto.createHash('sha1').update(sortArr.join('')).digest('hex');

    return signature === msgSignature;
  }


  /**
   * 解析回调消息（被动响应）
   */
  async parseCallbackMessage(xmlContent: string): Promise<CallbackMessage | null> {
    return this.parseCallbackMessageEncryptMode(xmlContent);
  }

  /**
   * 解析回调消息（被动响应）
   */
  async parseCallbackMessageEncryptMode(xmlContent: string): Promise<CallbackMessage | null> {
    try {
      const parser = new xml2js.Parser({ explicitArray: false });
      const result = await parser.parseStringPromise(xmlContent);

      const xml = result.xml;
      const encrypt = xml?.Encrypt;

      if (!encrypt) {
        return null;
      }

      // 使用EncodingAESKey解密
      const decryptedXml = this.decrypt(encrypt);
      const decryptedResult = await parser.parseStringPromise(decryptedXml);

      return this.parseMessage(decryptedResult.xml);
    } catch (error: any) {
      logger.error('解析回调消息失败:', error.message);
      return null;
    }
  }

  /**
   * 解析消息（被动响应模式）
   */
  parseMessage(xmlContent: string | object): CallbackMessage | null {
    try {
      const xml = typeof xmlContent === 'string' ? JSON.parse(xmlContent) : xmlContent;

      return {
        msgType: xml.MsgType || '',
        content: xml.Content || '',
        fromUserName: xml.FromUserName || '',
        toUserName: xml.ToUserName || '',
        createTime: xml.CreateTime || '',
        event: xml.Event,
        eventKey: xml.EventKey
      };
    } catch (error: any) {
      logger.error('解析消息失败:', error.message);
      return null;
    }
  }

  /**
   * 解密消息（基于AES）
   */
  private decrypt(encryptedStr: string): string {
    const aesKey = Buffer.from(this.config.encodingAesKey + '=', 'base64');
    const cipherBuffer = Buffer.from(encryptedStr, 'base64');

    // 初始化向量 = md5(corpid + agentid).digest + 16位0
    const iv = crypto.createHash('md5')
      .update(this.config.corpId + this.config.agentId)
      .digest();

    const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, iv);
    decipher.setAutoPadding(false);

    const decrypted = Buffer.concat([decipher.update(cipherBuffer), decipher.final()]);

    // 移除PKCS7填充
    const pad = decrypted[decrypted.length - 1];
    const plaintext = decrypted.slice(0, decrypted.length - pad);

    // 去掉前16字节（随机串）和后4字节（msg_len）
    const msgLen = plaintext.readUInt32BE(16);
    const msg = plaintext.slice(20, 20 + msgLen).toString('utf8');

    return msg;
  }

  /**
   * 生成回调URL的签名（用于URL验证）
   */
  generateCallbackSignature(timestamp: string, nonce: string, echostr: string): string {
    const sortArr = [this.config.token, timestamp, nonce, echostr].sort();
    return crypto.createHash('sha1').update(sortArr.join('')).digest('hex');
  }

  /**
   * 解密回调URL的echostr
   */
  decryptEchostr(echostr: string): string {
    return this.decrypt(echostr);
  }
}

/**
 * 企业微信群机器人
 * 用于向群聊推送消息（只能发送，不能接收）
 */
export class WxWorkRobot {
  private webhookUrl: string;

  constructor(webhookUrl: string) {
    this.webhookUrl = webhookUrl;
  }

  /**
   * 发送文本消息
   */
  async sendTextMessage(content: string): Promise<boolean> {
    try {
      const response = await axios.post(this.webhookUrl, {
        msgtype: 'text',
        text: {
          content: content
        }
      });

      const data = response.data;

      if (data.errcode !== 0) {
        logger.error(`群机器人发送消息失败: ${data.errmsg}`);
        return false;
      }

      return true;
    } catch (error: any) {
      logger.error('群机器人发送消息异常:', error.message);
      return false;
    }
  }

  /**
   * 发送Markdown消息
   */
  async sendMarkdownMessage(content: string): Promise<boolean> {
    try {
      const response = await axios.post(this.webhookUrl, {
        msgtype: 'markdown',
        markdown: {
          content
        }
      });

      const data = response.data;

      if (data.errcode !== 0) {
        logger.error(`群机器人发送消息失败: ${data.errmsg}`);
        return false;
      }

      return true;
    } catch (error: any) {
      logger.error('群机器人发送消息异常:', error.message);
      return false;
    }
  }

  /**
   * 发送图文消息
   */
  async sendNewsMessage(articles: Array<{
    title: string;
    description?: string;
    url: string;
    picurl?: string;
  }>): Promise<boolean> {
    try {
      const response = await axios.post(this.webhookUrl, {
        msgtype: 'news',
        news: {
          articles
        }
      });

      const data = response.data;

      if (data.errcode !== 0) {
        logger.error(`群机器人发送消息失败: ${data.errmsg}`);
        return false;
      }

      return true;
    } catch (error: any) {
      logger.error('群机器人发送消息异常:', error.message);
      return false;
    }
  }
}
