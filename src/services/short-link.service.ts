import { AppDataSource } from '../config/database';
import { ShortLink } from '../models/short-link.model';
import { ProductTbSku } from '../models/product-tb-sku.model';
import { nanoid } from 'nanoid';
import QRCode from 'qrcode';
import { logger } from '../utils/logger';

interface GenerateLinkOptions {
  platformId: number;
  ids: number[];
  quantities: number[];
  itemIds?: string[];  
}

interface LinkItem {
  id: number;  
  productName?: string;
  materialCode: string;
  quantity: number;
  itemId: string;
  skuId: string;
  itemIds?: string[];
  skuIds: string[];
}

/**
 * 短链接服务
 * 提供短链接生成、解析、二维码生成功能
 */
export class ShortLinkService {
  private shortLinkRepository = AppDataSource.getRepository(ShortLink);

  /**
   * 生成短链接
   * @param options 生成选项
   * @returns 生成的短链接信息
   */
  async generateShortLink(options: GenerateLinkOptions): Promise<{
    id: number;
    shortCode?: string;
    originalUrl: string;
    shortUrl: string;
    expiresAt?: Date;
  }> {
    const { ids, quantities, platformId, itemIds } = options;
    if (!ids || !quantities || ids.length !== quantities.length) {
      throw new Error('Invalid options: ids and quantities must be provided and of the same length');
    }

    const queryBuilder = AppDataSource.getRepository(ProductTbSku)
      .createQueryBuilder('sku')
      .innerJoinAndSelect('sku.product', 'product')
      .where('sku.platformId = :platformId', { platformId })
      .andWhere('sku.productId IN (:...ids)', { ids });

    const productQuantities = new Map<number, number>();
    for(let i = 0; i < ids.length; i++) {
      productQuantities.set(Number(ids[i]), quantities[i]);
    }

    const result = {
      id: 0,
      shortCode: "",
      originalUrl: "",
      orderUrl: "",
      shortUrl: "",
      qrCodeImageUrl: "",
      expiresAt: new Date(),
      data: [] as LinkItem[],
    }

    const items = [] as string[]
    const orderItems = [] as string[]
    const [records] = await queryBuilder.getManyAndCount()
    const recordData = records.reduce((acc, cur) => {
      if (acc[cur.productId]) {
        acc[cur.productId].itemIds!.push(cur.tbItemId);
        acc[cur.productId].skuIds!.push(cur.tbSkuId);
      }
      else {
        acc[cur.productId] = {
          id: cur.productId,
          productName: cur.product?.name || '',
          materialCode: cur.materialCode,
          quantity: productQuantities.get(cur.productId) || 0,
          itemId: cur.tbItemId,
          skuId: cur.tbSkuId, 
          itemIds: [cur.tbItemId] as string[],
          skuIds: [cur.tbSkuId] as string[]         
        };
      }
      return acc;
    }, {} as Record<string, LinkItem>);

    if (itemIds && itemIds.length > 0) {
      for(let i = 0; i < itemIds.length; i++) {
        const sku = recordData[ids[i]]
        if (sku && sku.itemIds && sku.itemIds.length > 1) {
          if (sku.itemIds.includes(itemIds[i])) {
            sku.itemId = itemIds[i];
            sku.skuId = sku.skuIds[sku.itemIds.indexOf(sku.itemId)];
          }
        }
      }
    }
    

    if (Object.keys(recordData).length !== ids.length) {
      result.originalUrl = "缺失部分或全部SKU信息，生成失败"
      result.shortUrl = result.originalUrl
    } else {
      for(let i = 0; i < ids.length; i++) {
        const sku = recordData[ids[i]]
        if (!sku) throw Error("SKU信息不存在")
        items.push(`${sku.itemId}_${sku.skuId}_${productQuantities.get(Number(ids[i]))}`)
        orderItems.push(`${sku.itemId}_${productQuantities.get(Number(ids[i]))}_${sku.skuId}`)
      }
      result.originalUrl = `https://h5.m.taobao.com/smart-interaction/cloud-shelf.html?itemIds=${encodeURIComponent(items.join('%2C'))}&back=https%3A%2F%2Fmain.m.taobao.com%2Fcart%2Findex.html&type=tb`
      result.orderUrl = `https://h5.m.taobao.com/cart/order.html?buyParam=${encodeURIComponent(orderItems.join('%2C'))}`
      result.data = Object.values(recordData);
    }

    if (result.originalUrl.substring(0, 4) === "http") {
      // 生成短码
      const shortCode = nanoid(8);

      // 计算过期时间（30天后）
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      result.expiresAt = expiresAt

      // 保存到数据库
      const shortLink = this.shortLinkRepository.create({
        shortCode,
        originalUrl: result.originalUrl,
        items: JSON.stringify(items),
        shopId: null,
        expiresAt,
        accessCount: 0
      });

      await this.shortLinkRepository.save(shortLink);


      // 构建短链接URL
      result.shortUrl = `${process.env.SHORT_URL || 'https://url.dsbull.com/'}${shortCode}`;
      result.qrCodeImageUrl = `${process.env.BASE_URL || 'https://erp.dsbull.com'}/api/v1/s/qrcode/${shortCode}`;
      logger.info(`生成短链接成功: ${shortCode}`);
    }
    
    return result;
  }

  /**
   * 解析短链接
   * @param shortCode 短码
   * @returns 原始URL和访问信息
   */
  async resolveShortLink(shortCode: string): Promise<{
    originalUrl: string;
    items: LinkItem[];
    expiresAt: Date | null;
    accessCount: number;
  }> {
    const shortLink = await this.shortLinkRepository.findOne({
      where: { shortCode }
    });

    if (!shortLink) {
      throw new Error('短链接不存在');
    }

    // 检查是否过期
    if (shortLink.expiresAt && shortLink.expiresAt < new Date()) {
      throw new Error('短链接已过期');
    }

    // 更新访问次数
    shortLink.accessCount += 1;
    shortLink.lastAccessedAt = new Date();
    await this.shortLinkRepository.save(shortLink);

    logger.info(`短链接访问: ${shortCode}, 访问次数: ${shortLink.accessCount}`);

    return {
      originalUrl: shortLink.originalUrl,
      items: shortLink.items ? JSON.parse(shortLink.items) : "",
      expiresAt: shortLink.expiresAt,
      accessCount: shortLink.accessCount
    };
  }

  /**
   * 生成短链接的二维码
   * @param shortCode 短码
   * @param options 二维码选项
   * @returns 二维码图片Buffer
   */
  async generateQRCode(
    shortCode: string,
    options: {
      width?: number;
      margin?: number;
      color?: { dark: string; light: string };
    } = {}
  ): Promise<Buffer> {
    const shortLink = await this.shortLinkRepository.findOne({
      where: { shortCode }
    });

    if (!shortLink) {
      throw new Error('短链接不存在');
    }

    const shortUrl = `${process.env.SHORT_URL || 'https://url.dsbull.com/'}${shortCode}`;

    const qrOptions = {
      width: options.width || 300,
      margin: options.margin || 2,
      color: {
        dark: options.color?.dark || '#000000',
        light: options.color?.light || '#ffffff'
      }
    };

    try {
      const qrCodeBuffer = await QRCode.toBuffer(shortUrl, qrOptions);
      logger.info(`生成二维码成功: ${shortCode}`);
      return qrCodeBuffer;
    } catch (error) {
      logger.error(`生成二维码失败: ${shortCode}`, error);
      throw new Error('生成二维码失败');
    }
  }

  /**
   * 生成短链接的二维码（Base64格式）
   * @param shortCode 短码
   * @param options 二维码选项
   * @returns Base64格式的二维码图片
   */
  async generateQRCodeBase64(
    shortCode: string,
    options?: {
      width?: number;
      margin?: number;
      color?: { dark: string; light: string };
    }
  ): Promise<string> {
    const qrCodeBuffer = await this.generateQRCode(shortCode, options);
    return `data:image/png;base64,${qrCodeBuffer.toString('base64')}`;
  }

  /**
   * 获取短链接详情
   * @param shortCode 短码
   * @returns 短链接详细信息
   */
  async getShortLinkDetail(shortCode: string): Promise<{
    id: number;
    shortCode: string;
    originalUrl: string;
    shortUrl: string;
    items: LinkItem[];
    shopId: string | null;
    expiresAt: Date | null;
    accessCount: number;
    lastAccessedAt: Date | null;
    createdAt: Date;
  } | null> {
    const shortLink = await this.shortLinkRepository.findOne({
      where: { shortCode }
    });

    if (!shortLink) {
      return null;
    }

    return {
      id: shortLink.id,
      shortCode: shortLink.shortCode,
      originalUrl: shortLink.originalUrl,
      shortUrl: `${process.env.SHORT_URL || 'https://url.dsbull.com/'}${shortLink.shortCode}`,
      items: shortLink.items ? JSON.parse(shortLink.items) : "",
      shopId: shortLink.shopId,
      expiresAt: shortLink.expiresAt,
      accessCount: shortLink.accessCount,
      lastAccessedAt: shortLink.lastAccessedAt,
      createdAt: shortLink.createdAt
    };
  }

  /**
   * 获取短链接列表
   * @param page 页码
   * @param size 每页数量
   * @returns 短链接列表
   */
  async getShortLinkList(page: number = 1, size: number = 20): Promise<{
    list: Array<{
      id: number;
      shortCode: string;
      shortUrl: string;
      items: LinkItem[];
      accessCount: number;
      expiresAt: Date | null;
      createdAt: Date;
    }>;
    total: number;
    page: number;
    size: number;
  }> {
    const [list, total] = await this.shortLinkRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * size,
      take: size
    });

    return {
      list: list.map(item => ({
        id: item.id,
        shortCode: item.shortCode,
        shortUrl: `${process.env.SHORT_URL || 'https://url.dsbull.com/'}${item.shortCode}`,
        items: item.items ? JSON.parse(item.items) : "",
        accessCount: item.accessCount,
        expiresAt: item.expiresAt,
        createdAt: item.createdAt
      })),
      total,
      page,
      size
    };
  }

  /**
   * 删除短链接
   * @param shortCode 短码
   * @returns 是否删除成功
   */
  async deleteShortLink(shortCode: string): Promise<boolean> {
    const result = await this.shortLinkRepository.delete({ shortCode });
    logger.info(`删除短链接: ${shortCode}, 影响行数: ${result.affected}`);
    return (result.affected || 0) > 0;
  }

  /**
   * 清理过期短链接
   * @returns 清理的数量
   */
  async cleanExpiredLinks(): Promise<number> {
    const result = await this.shortLinkRepository
      .createQueryBuilder()
      .delete()
      .where('expiresAt < :now', { now: new Date() })
      .execute();

    logger.info(`清理过期短链接: ${result.affected} 条`);
    return result.affected || 0;
  }
}

// 导出单例
export const shortLinkService = new ShortLinkService();
