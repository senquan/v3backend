import { AppDataSource } from '../config/database';
import { Product } from '../models/product.model';
import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

export class ImageProcessorController {
  /**
   * 生成缩略图
   * @param uploadsDir uploads目录路径
   */
  async generateThumbnails(uploadsDir?: string): Promise<void> {
    try {
      // 获取当前目录
      const currentDir = process.cwd();
      // uploads目录路径
      const uploadPath = uploadsDir || process.env.UPLOAD_PATH || './uploads';
      const fullUploadDir = path.join(currentDir, uploadPath);
      
      // 检查uploads目录是否存在
      if (!fs.existsSync(fullUploadDir)) {
        logger.error(`uploads目录不存在: ${fullUploadDir}`);
        return;
      }
      
      // thumb子目录路径
      const thumbDir = path.join(fullUploadDir, 'thumb');
      
      // 确保thumb目录存在
      if (!fs.existsSync(thumbDir)) {
        fs.mkdirSync(thumbDir, { recursive: true });
        logger.info(`创建thumb目录: ${thumbDir}`);
      }
      
      // 读取uploads目录中的所有文件
      const files = fs.readdirSync(fullUploadDir);
      logger.info(`在uploads目录中找到 ${files.length} 个文件`);
      
      let processedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;
      
      // 遍历所有文件
      for (const file of files) {
        // 跳过thumb目录
        if (file === 'thumb') {
          continue;
        }
        
        const filePath = path.join(fullUploadDir, file);
        
        // 检查是否是文件（而不是目录）
        if (!fs.statSync(filePath).isFile()) {
          continue;
        }
        
        // 检查是否是图片文件
        const ext = path.extname(file).toLowerCase();
        if (!['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'].includes(ext)) {
          continue;
        }
        
        try {
          // 检查thumb目录中是否已存在同名文件
          const thumbFilePath = path.join(thumbDir, file);
          if (fs.existsSync(thumbFilePath)) {
            logger.debug(`缩略图已存在，跳过: ${file}`);
            skippedCount++;
            continue;
          }
          
          // 生成缩略图（固定高度100px，宽度按比例缩放）
          await sharp(filePath)
            .resize({ height: 100, withoutEnlargement: true })
            .jpeg({ quality: 80 }) // 统一输出为JPEG格式以减小文件大小
            .toFile(thumbFilePath);
          
          logger.info(`已生成缩略图: ${file}`);
          processedCount++;
        } catch (err) {
          logger.error(`生成缩略图失败 ${file}: ${err}`);
          errorCount++;
        }
      }
      
      logger.info(`缩略图生成完成: 处理了 ${processedCount} 个文件, 跳过 ${skippedCount} 个文件, 失败 ${errorCount} 个`);
    } catch (error) {
      logger.error(`缩略图生成失败: ${error}`);
    }
  }

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