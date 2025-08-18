import { AppDataSource } from '../config/database';
import { Product } from '../models/product.model';
import { Gallery } from '../models/gallery.model';
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

  async processGallery(): Promise<void> {
    try {
      // 获取当前目录
      const currentDir = process.cwd();
      
      // 获取产品仓库
      const productRepository = AppDataSource.getRepository(Product);
      const products = await productRepository.find({
        where: { isDeleted: 0 }
      });

      // 获取图片库
      const galleryRepository = AppDataSource.getRepository(Gallery);
      const galleryImages = await galleryRepository.find({
        where: { isDeleted: 0 }
      });
      console.log("图片库图片数量:", galleryImages.length);
      // 构建图片数组，filePath 唯一，能快速识别是否存在
      const imageCache = [] as string[]
      galleryImages.forEach(item => {
        imageCache.push(item.filePath);
      })
      console.log("图片库:", imageCache);

      let insertCount = 0;
      let existsCount = 0;
      let fileNotFoundCount = 0;
      
      // 遍历所有文件
      for (const product of products) {
        const images = product.imageUrls?.split(',');
        if (images) {
          for (const image of images) {
            if (!image.startsWith('/uploads/')) {
              continue;
            }
            console.log("当前处理图片：", image);
            const filePath = path.join(currentDir, image);
            console.log("当前处理图片路径：", filePath);
            if (fs.existsSync(filePath)) {
              console.log("文件存在");
              const fileName = path.basename(filePath);
              const fileSize = fs.statSync(filePath).size;
              const fileType = image.split(".")[1];
              const mimeType = this.getMimeType(fileType);
              const { width, height } = await sharp(filePath).metadata();
              if (!imageCache.includes(image)) {
                // 图片库中不存在，需要新增
                const gallery = new Gallery();
                gallery.title = product.name;
                gallery.description = product.remark;
                gallery.fileName = fileName;
                gallery.filePath = image;
                gallery.fileUrl = image;
                gallery.fileSize = fileSize;
                gallery.fileType = fileType;
                gallery.mimeType = mimeType;
                gallery.width = width || 0;
                gallery.height = height || 0;
                gallery.thumbnailUrl = image.replace('uploads/', 'uploads/thumb/');;
                gallery.categoryId = 1;
                gallery.altText = product.name;
                gallery.sortOrder = 0;
                gallery.uploadBy = 1;
                const savedGallery = await galleryRepository.save(gallery);
                insertCount++;
                imageCache.push(image);
              } else {
                console.log("图库中已存在该图片");
                existsCount++;
              }
            } else {
              console.log("文件不存在");
              fileNotFoundCount++;
            }
          }
        }
      }
      logger.info(`处理完成: 新增 ${insertCount} 个产品, 图库存在 ${existsCount} 个图片, 文件不存在 ${fileNotFoundCount} 个`);
    } catch (error) {
      logger.error(`图片处理失败: ${error}`);
    }
  }

  getMimeType(fileType: string) {
    switch (fileType) {
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.png':
        return 'image/png';
      case '.gif':
        return 'image/gif';
      case '.webp':
        return 'image/webp';
      case '.svg':
        return 'image/svg+xml';
      case '.bmp':
        return 'image/bmp';
      default:
        return 'application/octet-stream';
    }
  }
}
