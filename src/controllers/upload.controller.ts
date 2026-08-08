import { Logger } from '@nestjs/common';
import { ImageProcessorController } from './image-processor.controller';
import * as path from 'path';
import sharp from 'sharp';

const uploadsDir = process.env.UPLOAD_PATH || './uploads';
const cwd = process.cwd();

export class UploadController {
    private readonly logger = new Logger(UploadController.name);
    private readonly imageProcessor = new ImageProcessorController();

    async uploadImage(file: Express.Multer.File) {
      this.logger.log(`文件上传成功: ${file.originalname}`);

      const relativePath = path.relative(cwd, file.path);
      const relativeUrl = '/' + relativePath.replace(/\\/g, '/');

      let width: number | undefined;
      let height: number | undefined;

      try {
        const metadata = await sharp(file.path).metadata();
        width = metadata.width;
        height = metadata.height;
      } catch (error) {
        this.logger.warn(`获取图片尺寸失败: ${error}`);
      }

      setImmediate(() => {
        this.generateThumbnailAsync(file.path).catch(error => {
          this.logger.error(`缩略图生成异步处理失败: ${error}`);
        });
      });

      return {
        code: 0,
        data: {
          url: relativeUrl,
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

      setImmediate(() => {
        files.forEach(file => {
          this.generateThumbnailAsync(file.path).catch(error => {
            this.logger.error(`缩略图生成异步处理失败: ${error}`);
          });
        });
      });

      return {
        code: 0,
        data: {
          urls: files.map(file => {
            const relativePath = path.relative(cwd, file.path);
            return '/' + relativePath.replace(/\\/g, '/');
          })
        }
      };
    }

    private async generateThumbnailAsync(filePath: string): Promise<void> {
      try {
        const ext = path.extname(filePath).toLowerCase();
        if (!['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'].includes(ext)) {
          return;
        }

        await this.imageProcessor.generateThumbnails(uploadsDir);

        this.logger.log(`缩略图生成成功: ${path.basename(filePath)}`);
      } catch (error) {
        this.logger.error(`缩略图生成失败: ${error}`);
      }
    }
  }