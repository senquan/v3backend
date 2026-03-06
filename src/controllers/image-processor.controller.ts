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
}
