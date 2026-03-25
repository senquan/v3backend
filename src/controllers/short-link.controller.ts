import { Request, Response } from 'express';
import { shortLinkService } from '../services/short-link.service';
import { successResponse, errorResponse } from '../utils/response';
import { logger } from '../utils/logger';

/**
 * 短链接控制器
 */
export class ShortLinkController {
  /**
   * 生成短链接
   */
  async generate(req: Request, res: Response) {
    try {
      const result = await shortLinkService.generateShortLink(req.body);
      return successResponse(res, result, '短链接生成成功');
    } catch (error: any) {
      logger.error('生成短链接失败:', error);
      return errorResponse(res, 500, error.message || '生成短链接失败');
    }
  }

  /**
   * 解析短链接（重定向到原始URL）
   */
  async resolve(req: Request, res: Response) {
    try {
      const { code } = req.params;

      const result = await shortLinkService.resolveShortLink(code);

      // 重定向到原始URL
      return res.redirect(result.originalUrl);
    } catch (error: any) {
      logger.error('解析短链接失败:', error);

      if (error.message === '短链接不存在' || error.message === '短链接已过期') {
        return res.status(404).render('error', {
          message: error.message
        });
      }

      return errorResponse(res, 500, '服务器错误');
    }
  }

  /**
   * 获取短链接详情
   */
  async getDetail(req: Request, res: Response) {
    try {
      const { code } = req.params;

      const result = await shortLinkService.getShortLinkDetail(code);

      if (!result) {
        return errorResponse(res, 404, '短链接不存在');
      }

      return successResponse(res, result, '获取成功');
    } catch (error: any) {
      logger.error('获取短链接详情失败:', error);
      return errorResponse(res, 500, error.message || '获取失败');
    }
  }

  /**
   * 获取短链接列表
   */
  async getList(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const size = parseInt(req.query.size as string) || 20;

      const result = await shortLinkService.getShortLinkList(page, size);

      return successResponse(res, result, '获取成功');
    } catch (error: any) {
      logger.error('获取短链接列表失败:', error);
      return errorResponse(res, 500, error.message || '获取失败');
    }
  }

  /**
   * 生成二维码（返回图片）
   */
  async generateQRCode(req: Request, res: Response) {
    try {
      const { code } = req.params;
      const width = parseInt(req.query.width as string) || 300;
      const margin = parseInt(req.query.margin as string) || 2;

      const qrCodeBuffer = await shortLinkService.generateQRCode(code, {
        width,
        margin
      });

      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Disposition', `attachment; filename=qrcode_${code}.png`);
      return res.send(qrCodeBuffer);
    } catch (error: any) {
      logger.error('生成二维码失败:', error);

      if (error.message === '短链接不存在') {
        return errorResponse(res, 404, '短链接不存在');
      }

      return errorResponse(res, 500, error.message || '生成二维码失败');
    }
  }

  /**
   * 生成二维码（返回Base64）
   */
  async generateQRCodeBase64(req: Request, res: Response) {
    try {
      const { code } = req.params;
      const width = parseInt(req.query.width as string) || 300;

      const base64 = await shortLinkService.generateQRCodeBase64(code, { width });

      return successResponse(res, { qrcode: base64 }, '二维码生成成功');
    } catch (error: any) {
      logger.error('生成二维码失败:', error);

      if (error.message === '短链接不存在') {
        return errorResponse(res, 404, '短链接不存在');
      }

      return errorResponse(res, 500, error.message || '生成二维码失败');
    }
  }

  /**
   * 删除短链接
   */
  async delete(req: Request, res: Response) {
    try {
      const { code } = req.params;

      const success = await shortLinkService.deleteShortLink(code);

      if (!success) {
        return errorResponse(res, 404, '短链接不存在');
      }

      return successResponse(res, null, '删除成功');
    } catch (error: any) {
      logger.error('删除短链接失败:', error);
      return errorResponse(res, 500, error.message || '删除失败');
    }
  }

  /**
   * 清理过期短链接
   */
  async cleanExpired(req: Request, res: Response) {
    try {
      const count = await shortLinkService.cleanExpiredLinks();

      return successResponse(res, { count }, `清理了 ${count} 条过期短链接`);
    } catch (error: any) {
      logger.error('清理过期短链接失败:', error);
      return errorResponse(res, 500, error.message || '清理失败');
    }
  }
}

export const shortLinkController = new ShortLinkController();
