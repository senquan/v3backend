export class UploadController {
    uploadFile(file: Express.Multer.File) {
      console.log(`文件上传成功: ${file.filename}`);
      return {
        code: 0,
        data: { url: `/uploads/${file.filename}` }
      };
    }
    
    uploadFiles(files: Express.Multer.File[]) {
      console.log(`批量上传成功: ${files.length}个文件`);
      return {
        code: 0,
        data: { urls: files.map(file => `/uploads/${file.filename}`) }
      };
    }
  }