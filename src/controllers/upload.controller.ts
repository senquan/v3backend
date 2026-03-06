import { Logger } from '@nestjs/common';
import { ImageProcessorController } from './image-processor.controller';
import * as path from 'path';
import sharp from 'sharp';

export class UploadController {
    private readonly logger = new Logger(UploadController.name);
    private readonly imageProcessor = new ImageProcessorController();
    
    async uploadImage(file: Express.Multer.File) {
      this.logger.log(`文件上传成功: ${file.filename}`);
      
      // 获取图片尺寸信息
      let width: number | undefined;
      let height: number | undefined;
      
      try {
        const uploadsDir = process.env.UPLOAD_PATH || './uploads';
        const filePath = path.join(process.cwd(), uploadsDir, file.filename);
        const metadata = await sharp(filePath).metadata();
        width = metadata.width;
        height = metadata.height;
      } catch (error) {
        this.logger.warn(`获取图片尺寸失败: ${error}`);
      }
      
      // 异步生成缩略图，不阻塞响应
      setImmediate(() => {
        this.generateThumbnailAsync(file.filename).catch(error => {
          this.logger.error(`缩略图生成异步处理失败: ${error}`);
        });
      });
      
      return {
        code: 0,
        data: {
          url: `/uploads/${file.filename}`,
          size: file.size,
          name: file.originalname,
          type: file.mimetype,
          width,
          height
        }
      };
    }
    
    uploadImages(files: Express.Multer.File[]) {
      this.logger.log(`批量上传成功: ${files.length}个文件`);
      
      // 异步生成缩略图，不阻塞响应
      setImmediate(() => {
        files.forEach(file => {
          this.generateThumbnailAsync(file.filename).catch(error => {
            this.logger.error(`缩略图生成异步处理失败: ${error}`);
          });
        });
      });
      
      return {
        code: 0,
        data: { urls: files.map(file => `/uploads/${file.filename}`) }
      };
    }
    
    /**
     * 异步生成单个文件的缩略图
     * @param filename 文件名
     */
    private async generateThumbnailAsync(filename: string): Promise<void> {
      try {
        const uploadsDir = process.env.UPLOAD_PATH || './uploads';
        const filePath = path.join(process.cwd(), uploadsDir, filename);
        const thumbDir = path.join(process.cwd(), uploadsDir, 'thumb');
        const thumbPath = path.join(thumbDir, filename);
        
        // 检查文件是否为图片
        const ext = path.extname(filename).toLowerCase();
        if (!['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'].includes(ext)) {
          return;
        }
        
        // 调用 ImageProcessorController 的缩略图生成方法
        await this.imageProcessor.generateThumbnails(uploadsDir);
        
        this.logger.log(`缩略图生成成功: ${filename}`);
      } catch (error) {
        this.logger.error(`缩略图生成失败 ${filename}: ${error}`);
      }
    }
  }