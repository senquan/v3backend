import { AppDataSource } from '../config/database';
import { Product } from '../models/product.model';
import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

export class ImageProcessorController {
  async processImages(): Promise<void> {
    try {
      // 获取当前目录
      const currentDir = process.cwd();
      // pics目录路径
      const picsDir = path.join(currentDir, 'pics');
      
      // 检查pics目录是否存在
      if (!fs.existsSync(picsDir)) {
        logger.error(`目录不存在: ${picsDir}`);
        return;
      }
      
      // 获取产品仓库
      const productRepository = AppDataSource.getRepository(Product);
      
      // 读取目录中的所有文件
      const files = fs.readdirSync(picsDir);
      logger.info(`找到 ${files.length} 个文件`);
      
      let updatedCount = 0;
      let errorCount = 0;
      
      // 遍历所有文件
      for (const file of files) {
        // 检查是否是图片文件
        const ext = path.extname(file).toLowerCase();
        if (!['.jpg', '.jpeg', '.png', '.gif'].includes(ext)) {
          logger.warn(`跳过非图片文件: ${file}`);
          continue;
        }
        
        try {
          // 从文件名中提取条形码
          const barcode = path.basename(file, ext);
          
          // 查找对应的产品
          const product = await productRepository.findOne({
            where: { barCode: barcode }
          });
          
          if (!product) {
            logger.warn(`未找到条形码对应的产品: ${barcode}`);
            continue;
          }
          
          // 更新产品的image_urls字段
          const imageUrl = `/uploads/${file}`;
          product.imageUrls = imageUrl;
          
          // 保存更新
          await productRepository.update(product.id, {
            imageUrls: imageUrl
          });
          
          // 复制图片到uploads目录
          const uploadDir = process.env.UPLOAD_PATH || './uploads';
          const fullUploadDir = path.join(currentDir, uploadDir);
          
          // 确保uploads目录存在
          if (!fs.existsSync(fullUploadDir)) {
            fs.mkdirSync(fullUploadDir, { recursive: true });
          }
          
          // 复制文件
          fs.copyFileSync(
            path.join(picsDir, file),
            path.join(fullUploadDir, file)
          );
          
          logger.info(`已更新产品 ${product.name} (${barcode}) 的图片`);
          updatedCount++;
        } catch (err) {
          logger.error(`处理文件 ${file} 时出错: ${err}`);
          errorCount++;
        }
      }
      
      logger.info(`处理完成: 更新了 ${updatedCount} 个产品, 失败 ${errorCount} 个`);
    } catch (error) {
      logger.error(`图片处理失败: ${error}`);
    }
  }
}