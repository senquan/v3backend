import { Response } from 'express';
import { successResponse, errorResponse } from '../utils/response';
import { BatchFile } from '../models/batch-file.entity'
import { AppDataSource } from '../config/database';

export class BatchFileController {

    private batchFileRepository = AppDataSource.getRepository(BatchFile);

    async create(req: any, res: Response) {
        try {
          const userId = (req as any).user?.id;
          if (!userId) return errorResponse(res, 401, '未授权');
    
          const { url, batchNo, remark } = req.body;
    
          if (!url || !batchNo) {
            return errorResponse(res, 400, '必填项不能为空');
          }
    
          const batchFile = new BatchFile();
          batchFile.url = url;
          batchFile.batchNo = batchNo;
          batchFile.remark = remark;
          batchFile.createdBy = userId;
          batchFile.createdAt = new Date()
    
          const saved = await this.batchFileRepository.save(batchFile);
          return successResponse(res, saved, '创建成功');
        } catch (error: any) {
          console.error('创建定期存款失败:', error);
          return errorResponse(res, 500, `创建失败: ${error.message || error}`);
        }
    }
}
