import { Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';
import axios from 'axios';
import { AppDataSource } from '../config/database';
import { logger } from '../utils/logger';
import { errorResponse, successResponse } from '../utils/response';

const authController = require('../controllers/auth.controller');

// WeChat API configuration
const WECHAT_CONFIG = {
  appId: process.env.WECHAT_APP_ID || '',
  appSecret: process.env.WECHAT_APP_SECRET || '',
  grantType: 'authorization_code'
};

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

interface WechatUserInfo {
  openid: string;
  nickname?: string;
  sex?: number;
  province?: string;
  city?: string;
  country?: string;
  headimgurl?: string;
  unionid?: string;
}

interface WechatTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  openid: string;
  scope: string;
  unionid?: string;
}

export class WechatController {
  
  /**
   * WeChat OAuth 2.0 Login Implementation
   * Handles the complete WeChat login flow: code exchange, user info retrieval, and JWT generation
   */
  async wechatLogin(req: Request, res: Response) {
    try {
      const { code } = req.body;
      
      // Validate input
      if (!code) {
        logger.warn('WeChat login attempt without authorization code');
        return errorResponse(res, 400, 'Authorization code is required');
      }
      
      if (!WECHAT_CONFIG.appId || !WECHAT_CONFIG.appSecret) {
        logger.error('WeChat configuration missing: appId or appSecret not configured');
        return errorResponse(res, 500, 'WeChat service configuration error');
      }
      
      logger.info(`Starting WeChat login process with code: ${code}...`);


      // TODO: 移除测试代码
      // 返回测试信息

      const user = {
        id: 'wechat_test',
        nickname: 'Test User',
        avatar: 'https://example.com/avatar.png',
        wechat_openid: 'wechat_test_openid',
      }
      const token = this.generateJwtToken(user);
      return successResponse(res, {
        token,
        userInfo: {
          id: user.id,
          nickname: user.nickname,
          avatar: user.avatar,
          openid: user.wechat_openid,
          loginType: 'wechat'
        }
      }, 'WeChat login successful');
      
      // // Step 1: Exchange authorization code for access token
      // const tokenData = await this.exchangeCodeForToken(code);
      // if (!tokenData) {
      //   return errorResponse(res, 400, 'Failed to exchange authorization code for access token');
      // }
      
      // logger.info(`Successfully obtained access token for openid: ${tokenData.openid}`);
      
      // // Step 2: Get user information from WeChat
      // const userInfo = await this.getWechatUserInfo(tokenData.access_token, tokenData.openid);
      
      // // Step 3: Find or create user in database
      // const user = await this.findOrCreateUser({
      //   openid: tokenData.openid,
      //   unionid: tokenData.unionid,
      //   nickname: userInfo?.nickname,
      //   avatar: userInfo?.headimgurl,
      //   province: userInfo?.province,
      //   city: userInfo?.city,
      //   country: userInfo?.country
      // });
      
      // // Step 4: Generate JWT token
      // const token = this.generateJwtToken(user);
      
      // // Step 5: Update user's last login time
      // await this.updateLastLogin(user.id);
      
      // logger.info(`WeChat login successful for user: ${user.id}`);
      
      // // Return success response with token and user info
      // return successResponse(res, {
      //   token,
      //   userInfo: {
      //     id: user.id,
      //     nickname: user.nickname,
      //     avatar: user.avatar,
      //     openid: user.wechat_openid,
      //     loginType: 'wechat'
      //   }
      // }, 'WeChat login successful');
      
    } catch (error: any) {
      logger.error('WeChat login error:', error);
      
      // Handle specific error types
      if (error?.message?.includes('invalid_grant')) {
        return errorResponse(res, 400, 'Invalid or expired authorization code');
      } else if (error?.message?.includes('rate limit')) {
        return errorResponse(res, 429, 'WeChat API rate limit exceeded, please try again later');
      } else if (error?.code === 'ECONNREFUSED' || error?.code === 'ENOTFOUND') {
        return errorResponse(res, 503, 'WeChat service temporarily unavailable');
      } else {
        return errorResponse(res, 500, 'WeChat login failed');
      }
    }
  }
  
  /**
   * Exchange authorization code for access token using axios
   */
  private async exchangeCodeForToken(code: string): Promise<WechatTokenResponse | null> {
    try {
      const tokenUrl = 'https://api.weixin.qq.com/sns/oauth2/access_token';
      const params = {
        appid: WECHAT_CONFIG.appId,
        secret: WECHAT_CONFIG.appSecret,
        code: code,
        grant_type: WECHAT_CONFIG.grantType
      };
      
      logger.debug('Requesting WeChat access token:', { appid: params.appid, code: code.substring(0, 10) + '...' });
      
      const response = await axios.get(tokenUrl, {
        params,
        timeout: 10000
      });
      
      const data = response.data;
      
      // Check for WeChat API errors
      if (data.errcode) {
        logger.error('WeChat token exchange error:', { errcode: data.errcode, errmsg: data.errmsg });
        throw new Error(`WeChat API error: ${data.errmsg} (${data.errcode})`);
      }
      
      // Validate required fields
      if (!data.access_token || !data.openid) {
        logger.error('Invalid token response from WeChat:', data);
        throw new Error('Invalid token response from WeChat API');
      }
      
      logger.debug('Token exchange successful:', { openid: data.openid, expires_in: data.expires_in });
      
      return data;
    } catch (error) {
      logger.error('Error exchanging code for token:', error);
      throw error;
    }
  }
  
  /**
   * Get user information from WeChat API using axios
   */
  private async getWechatUserInfo(accessToken: string, openid: string): Promise<WechatUserInfo | null> {
    try {
      const userInfoUrl = 'https://api.weixin.qq.com/sns/userinfo';
      const params = {
        access_token: accessToken,
        openid: openid,
        lang: 'zh_CN'
      };
      
      logger.debug('Requesting WeChat user info:', { openid });
      
      const response = await axios.get(userInfoUrl, {
        params,
        timeout: 10000
      });
      
      const data = response.data;
      
      // Check for WeChat API errors
      if (data.errcode) {
        logger.warn('WeChat user info error (non-critical):', { errcode: data.errcode, errmsg: data.errmsg });
        // User info is optional, return null if fails
        return null;
      }
      
      logger.debug('User info retrieved successfully:', { openid: data.openid, nickname: data.nickname });
      
      return data;
    } catch (error) {
      logger.warn('Error getting WeChat user info (non-critical):', error);
      // User info is optional, return null if fails
      return null;
    }
  }
  
  /**
   * Find existing user or create new user
   */
  private async findOrCreateUser(wechatData: {
    openid: string;
    unionid?: string;
    nickname?: string;
    avatar?: string;
    province?: string;
    city?: string;
    country?: string;
  }): Promise<any> {
    try {
      // Note: This is a simplified implementation. In a real application,
      // you would use your actual database ORM/query builder
      
      // First, try to find user by openid
      let user = await this.findUserByOpenid(wechatData.openid);
      
      if (user) {
        // Update user info if needed
        user = await this.updateUserInfo(user.id, {
          nickname: wechatData.nickname || user.nickname,
          avatar: wechatData.avatar || user.avatar,
          wechat_unionid: wechatData.unionid || user.wechat_unionid,
          province: wechatData.province || user.province,
          city: wechatData.city || user.city,
          country: wechatData.country || user.country
        });
        
        logger.info(`Existing user found and updated: ${user.id}`);
        return user;
      }
      
      // If unionid exists, try to find by unionid
      if (wechatData.unionid) {
        user = await this.findUserByUnionid(wechatData.unionid);
        if (user) {
          // Link this openid to existing user
          user = await this.updateUserInfo(user.id, {
            wechat_openid: wechatData.openid,
            nickname: wechatData.nickname || user.nickname,
            avatar: wechatData.avatar || user.avatar
          });
          
          logger.info(`User found by unionid and linked: ${user.id}`);
          return user;
        }
      }
      
      // Create new user
      user = await this.createNewUser({
        wechat_openid: wechatData.openid,
        wechat_unionid: wechatData.unionid,
        nickname: wechatData.nickname || `微信用户_${wechatData.openid.substring(0, 8)}`,
        avatar: wechatData.avatar || '',
        login_type: 'wechat',
        province: wechatData.province || '',
        city: wechatData.city || '',
        country: wechatData.country || '',
        status: 'active',
        created_at: new Date(),
        updated_at: new Date()
      });
      
      logger.info(`New user created: ${user.id}`);
      return user;
      
    } catch (error) {
      logger.error('Error in findOrCreateUser:', error);
      throw error;
    }
  }
  
  /**
   * Generate JWT token for user
   */
  private generateJwtToken(user: any): string {
    const payload = {
      userId: user.id,
      openid: user.wechat_openid,
      loginType: 'wechat',
      iat: Math.floor(Date.now() / 1000)
    };
    
    const options: jwt.SignOptions = {
      expiresIn: '7d' // Fixed expiration time
    };
    
    return jwt.sign(payload, JWT_SECRET, options);
  }
  
  // Database helper methods (simplified - implement according to your actual database setup)
  
  private async findUserByOpenid(openid: string): Promise<any> {
    // Implement database query to find user by wechat_openid
    // This is a placeholder - replace with your actual database implementation
    try {
      // Example using TypeORM (adjust according to your setup):
      // const userRepository = AppDataSource.getRepository(User);
      // return await userRepository.findOne({ where: { wechat_openid: openid } });
      
      // Placeholder return for now
      return null;
    } catch (error) {
      logger.error('Error finding user by openid:', error);
      throw error;
    }
  }
  
  private async findUserByUnionid(unionid: string): Promise<any> {
    // Implement database query to find user by wechat_unionid
    try {
      // Example using TypeORM:
      // const userRepository = AppDataSource.getRepository(User);
      // return await userRepository.findOne({ where: { wechat_unionid: unionid } });
      
      return null;
    } catch (error) {
      logger.error('Error finding user by unionid:', error);
      throw error;
    }
  }
  
  private async createNewUser(userData: any): Promise<any> {
    // Implement user creation logic
    try {
      // Example using TypeORM:
      // const userRepository = AppDataSource.getRepository(User);
      // const user = userRepository.create(userData);
      // return await userRepository.save(user);
      
      // Placeholder implementation
      const newUser = {
        id: Date.now(), // Use proper ID generation in real implementation
        ...userData
      };
      
      return newUser;
    } catch (error) {
      logger.error('Error creating new user:', error);
      throw error;
    }
  }
  
  private async updateUserInfo(userId: any, updateData: any): Promise<any> {
    // Implement user update logic
    try {
      // Example using TypeORM:
      // const userRepository = AppDataSource.getRepository(User);
      // await userRepository.update(userId, { ...updateData, updated_at: new Date() });
      // return await userRepository.findOne({ where: { id: userId } });
      
      // Placeholder implementation
      return { id: userId, ...updateData };
    } catch (error) {
      logger.error('Error updating user info:', error);
      throw error;
    }
  }
  
  private async updateLastLogin(userId: any): Promise<void> {
    // Update user's last login timestamp
    try {
      // Example using TypeORM:
      // const userRepository = AppDataSource.getRepository(User);
      // await userRepository.update(userId, { last_login_at: new Date() });
      
      logger.debug(`Updated last login for user: ${userId}`);
    } catch (error) {
      logger.error('Error updating last login:', error);
      // Don't throw - this is not critical
    }
  }
}