import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';

// WeChat API configuration
const WECHAT_CONFIG = {
  appId: process.env.WECHAT_APP_ID || '',
  appSecret: process.env.WECHAT_APP_SECRET || '',
};

// WeChat API URLs
const WECHAT_API = {
  getAccessToken: 'https://api.weixin.qq.com/cgi-bin/token',
  getUnlimitedQRCode: 'https://api.weixin.qq.com/wxa/getwxacodeunlimit'
};

interface AccessTokenResponse {
  access_token: string;
  expires_in: number;
  errcode?: number;
  errmsg?: string;
}

interface QRCodeOptions {
  scene: string;
  page?: string;
  check_path?: boolean;
  env_version?: 'release' | 'trial' | 'develop';
  width?: number;
  auto_color?: boolean;
  line_color?: {
    r: number;
    g: number;
    b: number;
  };
  is_hyaline?: boolean;
}

/**
 * 获取微信小程序访问令牌
 * @returns Promise<string | null> 返回access_token或null
 */
export async function getWechatAccessToken(): Promise<string | null> {
  try {
    if (!WECHAT_CONFIG.appId || !WECHAT_CONFIG.appSecret) {
      logger.error('WeChat configuration missing: appId or appSecret not configured');
      return null;
    }

    const response = await axios.get<AccessTokenResponse>(WECHAT_API.getAccessToken, {
      params: {
        grant_type: 'client_credential',
        appid: WECHAT_CONFIG.appId,
        secret: WECHAT_CONFIG.appSecret
      },
      timeout: 10000
    });

    const data = response.data;
    
    if (data.errcode) {
      logger.error(`Failed to get WeChat access token: ${data.errcode} - ${data.errmsg}`);
      return null;
    }

    if (!data.access_token) {
      logger.error('WeChat access token not found in response');
      return null;
    }

    logger.info('Successfully obtained WeChat access token');
    return data.access_token;
  } catch (error) {
    logger.error('Error getting WeChat access token:', error);
    return null;
  }
}

/**
 * 生成微信小程序二维码
 * @param recordId 培训记录ID
 * @param options 二维码选项
 * @returns Promise<string | null> 返回二维码文件路径或null
 */
export async function generateMiniProgramQRCode(
  recordId: string,
  options: Partial<QRCodeOptions> = {}
): Promise<string | null> {
  try {
    // 获取访问令牌
    const accessToken = await getWechatAccessToken();
    if (!accessToken) {
      logger.error('Failed to get access token for QR code generation');
      return null;
    }

    // 默认二维码选项
    const defaultOptions: QRCodeOptions = {
      scene: `id=${recordId}`,
      page: 'pages/plan-detail/plan-detail',
      check_path: false,
      env_version: 'release',
      width: 430,
      auto_color: false,
      is_hyaline: false,
      ...options
    };

    // logger.info(`Generating QR code for record: ${recordId}`);

    // 调用微信API生成二维码
    const response = await axios.post(
      `${WECHAT_API.getUnlimitedQRCode}?access_token=${accessToken}`,
      defaultOptions,
      {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    // 检查响应是否为错误信息
    const contentType = response.headers['content-type'];
    if (contentType && contentType.includes('application/json')) {
      const errorData = JSON.parse(response.data.toString());
      logger.error(`WeChat QR code generation failed: ${errorData.errcode} - ${errorData.errmsg}`);
      return null;
    }

    // 确保上传目录存在
    const uploadDir = path.join(process.cwd(), 'uploads', 'qrcode');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      logger.info(`Created QR code directory: ${uploadDir}`);
    }

    // 生成文件名
    const fileName = `${recordId}_${Date.now()}.jpg`;
    const filePath = path.join(uploadDir, fileName);

    // 保存二维码图片
    fs.writeFileSync(filePath, response.data);
    
    // 返回相对路径
    const relativePath = `/uploads/qrcode/${fileName}`;
    logger.info(`QR code generated successfully: ${relativePath}`);
    
    return relativePath;
  } catch (error) {
    logger.error('Error generating WeChat mini-program QR code:', error);
    return null;
  }
}

/**
 * 删除二维码文件
 * @param filePath 文件路径
 * @returns Promise<boolean> 删除是否成功
 */
export async function deleteQRCodeFile(filePath: string): Promise<boolean> {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      logger.info(`QR code file deleted: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    logger.error('Error deleting QR code file:', error);
    return false;
  }
}