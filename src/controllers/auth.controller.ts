const svgCaptcha = require('svg-captcha');
const { v4: uuidv4 } = require('uuid');
import { Request, Response } from 'express';

// 存储验证码的缓存
const captchaStore = new Map();

/**
 * 生成验证码
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 */
exports.generateCaptcha = (req: Request, res: Response) => {
  // 创建验证码
  const captcha = svgCaptcha.create({
    size: 4, // 验证码长度
    ignoreChars: '0o1il', // 排除容易混淆的字符
    noise: 2, // 干扰线条数量
    color: true, // 验证码的字符是否有颜色
    background: '#aec8e3' // 背景颜色
  });
  
  // 生成唯一标识符
  const captchaId = uuidv4();
  
  // 将验证码文本存储在服务器端，设置过期时间为5分钟
  captchaStore.set(captchaId, {
    text: captcha.text.toLowerCase(),
    expireAt: Date.now() + 5 * 60 * 1000
  });
  
  // 定期清理过期的验证码
  setTimeout(() => {
    const captchaData = captchaStore.get(captchaId);
    if (captchaData && Date.now() > captchaData.expireAt) {
      captchaStore.delete(captchaId);
    }
  }, 5 * 60 * 1000);
  
  // 返回验证码图片和ID
  res.status(200).json({
    code: 0,
    message: '获取验证码成功',
    data: {
      captchaId,
      captchaImg: `data:image/svg+xml;base64,${Buffer.from(captcha.data).toString('base64')}`
    }
  });
};

/**
 * 验证验证码
 * @param {string} captchaId - 验证码ID
 * @param {string} captchaText - 用户输入的验证码
 * @returns {boolean} - 验证结果
 */
exports.verifyCaptcha = (captchaId: string, captchaText: string) => {
  const captchaData = captchaStore.get(captchaId);
  
  // 验证码不存在或已过期
  if (!captchaData || Date.now() > captchaData.expireAt) {
    return false;
  }
  
  // 验证码匹配检查
  const isValid = captchaData.text === captchaText.toLowerCase();
  
  // 验证后删除验证码，防止重复使用
  if (isValid) {
    captchaStore.delete(captchaId);
  }
  
  return isValid;
};