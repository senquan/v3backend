import { Logger } from '@nestjs/common';

export class UploadController {
    private readonly logger = new Logger(UploadController.name);
    
    uploadImage(file: Express.Multer.File) {
      this.logger.log(`文件上传成功: ${file.filename}`);
      return {
        code: 0,
        data: { url: `/uploads/${file.filename}` }
      };
    }
    
    uploadImages(files: Express.Multer.File[]) {
      this.logger.log(`批量上传成功: ${files.length}个文件`);
      return {
        code: 0,
        data: { urls: files.map(file => `/uploads/${file.filename}`) }
      };
    }
  }