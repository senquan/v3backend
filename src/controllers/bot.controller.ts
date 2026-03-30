import { Request, Response } from 'express';
import { WechatyBot } from '../bot/wechaty-bot.service';
import { successResponse, errorResponse } from "../utils/response";

// 全局机器人实例
let wechatyBot: WechatyBot | null = null;
let botStatus: 'online' | 'offline' | 'connecting' = 'offline';
let currentQrCode: string = '';
let currentQrCodeUrl: string = '';

/**
 * 获取机器人状态
 */
export async function getBotStatus(_req: Request, res: Response) {
  try {
    let userData = null;
    if (wechatyBot && botStatus === "online") {
      try {
        const currentUser = wechatyBot.getCurrentUser();
        if (currentUser) {
          userData = {
            name: currentUser.name(),
            id: currentUser.id
          };
        }
      } catch (err) {
        // 如果还未登录，获取 currentUser 会抛出错误，忽略即可
        console.log("机器人未登录，无法获取当前用户信息");
      }
    }

    const result = {
      status: botStatus,
      isActive: wechatyBot?.isActive() || false,
      currentUser: userData
    };

    return successResponse(res, result, "获取机器人状态成功");
  } catch (error) {
    console.error("获取机器人状态失败:", error);
    return errorResponse(res, 500, "获取机器人状态失败");
  }
}

/**
 * 启动机器人
 */
export async function startBot(_req: Request, res: Response) {
  try {
    if (wechatyBot && wechatyBot.isActive()) {
      const result = {
        status: botStatus,
        isActive: true
      };
      return successResponse(res, result, "机器人已在运行中");
    }

    botStatus = "connecting";

    // 创建新的机器人实例
    // wechatyBot = new WechatyBot({
    //   name: "ExpressBot",
    //   puppet: "wechaty-puppet-wechat4u"
    // });

    wechatyBot = new WechatyBot({
      name: "ExpressBot",
      puppetOptions: {
        uos: true
      }
    });

    console.log("机器人实例已创建，正在注册事件监听器...");

    // 监听扫码事件以获取二维码
    wechatyBot.on("scan", (qrcode: string, status: any) => {
      console.log("收到 scan 事件, status:", status);
      currentQrCode = qrcode;
      currentQrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qrcode)}`;
      console.log("生成二维码:", currentQrCodeUrl);
      console.log("========================================");
      console.log("请扫描以下二维码登录微信：");
      console.log(currentQrCode);
      console.log("========================================");
    });

    // 监听登录成功事件
    wechatyBot.on("login", (user: any) => {
      console.log("收到 login 事件");
      botStatus = "online";
      currentQrCode = "";
      currentQrCodeUrl = "";
      console.log("机器人登录成功:", user.name());
    });

    // 监听登出事件
    wechatyBot.on("logout", (user: any) => {
      console.log("收到 logout 事件");
      botStatus = "offline";
      currentQrCode = "";
      currentQrCodeUrl = "";
      console.log("机器人已登出:", user.name());
    });

    // 监听错误事件
    wechatyBot.on("error", (error: any) => {
      console.error("收到 error 事件:", error);
      botStatus = "offline";
      // 自动停止机器人，避免无限重试
      if (wechatyBot && wechatyBot.isActive()) {
        console.log("检测到错误，正在停止机器人...");
        wechatyBot.stop().catch(err => {
          console.error("停止机器人失败:", err);
        });
      }
    });

    // 监听 ready 事件
    wechatyBot.on("ready", () => {
      console.log("收到 ready 事件");
    });

    // 监听 start 事件
    wechatyBot.on("start", () => {
      console.log("收到 start 事件");
    });

    // 启动机器人
    await wechatyBot.start();

    const result = {
      status: botStatus,
      isActive: wechatyBot.isActive(),
      qrcode: currentQrCode,
      qrcodeUrl: currentQrCodeUrl
    };

    return successResponse(res, result, "机器人启动成功");
  } catch (error) {
    console.error("启动机器人失败:", error);
    botStatus = "offline";
    return errorResponse(res, 500, "启动机器人失败");
  }
}

/**
 * 停止机器人
 */
export async function stopBot(_req: Request, res: Response) {
  try {
    if (!wechatyBot) {
      return successResponse(res, { status: "offline" }, "机器人未运行");
    }

    await wechatyBot.stop();
    botStatus = "offline";
    currentQrCode = "";
    currentQrCodeUrl = "";

    const result = {
      status: botStatus
    };

    return successResponse(res, result, "机器人已停止");
  } catch (error) {
    console.error("停止机器人失败:", error);
    return errorResponse(res, 500, "停止机器人失败");
  }
}

/**
 * 获取当前二维码
 */
export async function getQrCode(_req: Request, res: Response) {
  try {
    if (!currentQrCodeUrl) {
      return errorResponse(res, 400, "当前没有可用的二维码");
    }

    const result = {
      hasQrCode: true,
      qrcode: currentQrCode,
      qrcodeUrl: currentQrCodeUrl,
      status: botStatus
    };

    return successResponse(res, result, "获取二维码成功");
  } catch (error) {
    console.error("获取二维码失败:", error);
    return errorResponse(res, 500, "获取二维码失败");
  }
}

/**
 * 获取当前二维码（纯文本）
 */
export async function getQrCodeText(_req: Request, res: Response) {
  try {
    if (!currentQrCode) {
      return errorResponse(res, 400, "当前没有可用的二维码");
    }

    const result = {
      qrcode: currentQrCode,
      qrcodeUrl: currentQrCodeUrl,
      status: botStatus
    };

    return successResponse(res, result, "获取二维码成功");
  } catch (error) {
    console.error("获取二维码失败:", error);
    return errorResponse(res, 500, "获取二维码失败");
  }
}

/**
 * 重启机器人
 */
export async function restartBot(_req: Request, res: Response) {
  try {
    // 先停止
    if (wechatyBot) {
      await wechatyBot.stop();
    }

    // 清理状态
    botStatus = "offline";
    currentQrCode = "";
    currentQrCodeUrl = "";

    // 重新启动
    // 使用 UOS 模式以避免 Chrome 浏览器依赖
    process.env.WECHATY_PUPPET_WECHAT_UOS = "1";
    wechatyBot = new WechatyBot({
      name: "ExpressBot",
      puppet: "wechaty-puppet-wechat"
    });

    // 重新设置事件监听器
    wechatyBot.on("scan", (qrcode: string, _status: any) => {
      currentQrCode = qrcode;
      currentQrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qrcode)}`;
      console.log("生成二维码:", currentQrCodeUrl);
    });

    wechatyBot.on("login", (user: any) => {
      botStatus = "online";
      currentQrCode = "";
      currentQrCodeUrl = "";
      console.log("机器人登录成功:", user.name());
    });

    wechatyBot.on("logout", (user: any) => {
      botStatus = "offline";
      currentQrCode = "";
      currentQrCodeUrl = "";
      console.log("机器人已登出:", user.name());
    });

    wechatyBot.on("error", (error: any) => {
      console.error("机器人错误:", error);
      botStatus = "offline";
      // 自动停止机器人，避免无限重试
      if (wechatyBot && wechatyBot.isActive()) {
        console.log("检测到错误，正在停止机器人...");
        wechatyBot.stop().catch(err => {
          console.error("停止机器人失败:", err);
        });
      }
    });

    // 启动机器人
    await wechatyBot.start();

    const result = {
      status: botStatus,
      isActive: wechatyBot.isActive(),
      qrcode: currentQrCode,
      qrcodeUrl: currentQrCodeUrl
    };

    return successResponse(res, result, "机器人重启成功");
  } catch (error) {
    console.error("重启机器人失败:", error);
    botStatus = "offline";
    return errorResponse(res, 500, "重启机器人失败");
  }
}
