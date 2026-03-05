import { Request, Response } from 'express';
import { errorResponse, successResponse } from '../utils/response';
import { logger } from '../utils/logger';
import { DatabaseBackupService } from '../services/database-backup.service';
import * as path from 'path';

interface Backup {
  id: number
  backupCode: string
  backupName: string
  backupType: number
  backupMode: number
  filePath: string
  fileSize: number
  fileUrl: string
  status: number
  remark: string
  createdBy: string
  createdAt: string
  completedAt: string | null
}

export class BackupController {
  private backupService: DatabaseBackupService;

  constructor() {
    this.backupService = new DatabaseBackupService();
  }

  async getAll(req: Request, res: Response): Promise<Response> {
    try {
      const { page = 1, size = 10, backupName, backupType, status } = req.query;
      const pageNum = parseInt(page as string);
      const pageSize = parseInt(size as string);

      // 从备份服务获取真实的备份文件列表
      const backupFiles = await this.backupService.getBackupList();
      
      // 将备份文件转换为 Backup 接口格式
      let filteredData: Backup[] = backupFiles.map((file, index) => ({
        id: index + 1,
        backupCode: `BK${file.createdAt.toISOString().replace(/[:.]/g, '-')}`,
        backupName: file.fileName.replace('.sql', '').replace(/_/g, '-'),
        backupType: file.fileName.includes('incremental') ? 2 : file.fileName.includes('differential') ? 3 : 1,
        backupMode: 1, // 默认为完整备份
        filePath: file.filePath,
        fileSize: file.fileSize,
        fileUrl: `/api/v1/system/backups/download?file=${file.fileName}`,
        status: 2, // 已完成
        remark: '自动备份',
        createdBy: 'system',
        createdAt: file.createdAt.toISOString(),
        completedAt: file.createdAt.toISOString()
      }));

      // 应用筛选条件
      if (backupName) {
        filteredData = filteredData.filter(item => item.backupName.includes(backupName as string));
      }
      if (backupType) {
        filteredData = filteredData.filter(item => item.backupType === parseInt(backupType as string));
      }
      if (status) {
        filteredData = filteredData.filter(item => item.status === parseInt(status as string));
      }

      // 分页
      const total = filteredData.length;
      const skip = (pageNum - 1) * pageSize;
      const items = filteredData.slice(skip, skip + pageSize);

      return successResponse(res, { items, total, page: pageNum, size: pageSize }, '查询成功');
    } catch (error: any) {
      logger.error('获取备份列表失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  async getById(req: Request, res: Response): Promise<Response> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return errorResponse(res, 400, '无效的备份 ID', null);
      }
  
      // 从备份服务获取真实的备份文件列表
      const backupFiles = await this.backupService.getBackupList();
        
      // 查找对应的备份文件
      if (id < 1 || id > backupFiles.length) {
        return errorResponse(res, 404, '备份不存在', null);
      }
  
      const file = backupFiles[id - 1];
      const backup: Backup = {
        id: id,
        backupCode: `BK${file.createdAt.toISOString().replace(/[:.]/g, '-')}`,
        backupName: file.fileName.replace('.sql', '').replace(/_/g, '-'),
        backupType: file.fileName.includes('incremental') ? 2 : file.fileName.includes('differential') ? 3 : 1,
        backupMode: 1,
        filePath: file.filePath,
        fileSize: file.fileSize,
        fileUrl: `/api/v1/system/backups/download?file=${file.fileName}`,
        status: 2,
        remark: '自动备份',
        createdBy: 'system',
        createdAt: file.createdAt.toISOString(),
        completedAt: file.createdAt.toISOString()
      };
  
      return successResponse(res, backup, '查询成功');
    } catch (error: any) {
      logger.error('获取备份详情失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  async create(req: Request, res: Response): Promise<Response> {
    try {
      const { backupName, backupType, backupMode, remark } = req.body;
      
      // 根据备份类型执行不同的备份策略
      let backupResult;
      const includeSchema = backupMode === 1; // 手动备份包含 schema
      
      switch (backupType) {
        case 1: // 完整备份
          backupResult = await this.backupService.performFullBackup(backupName, includeSchema);
          break;
        case 2: // 增量备份
          backupResult = await this.backupService.performIncrementalBackup(backupName);
          break;
        case 3: // 差异备份
          backupResult = await this.backupService.performDifferentialBackup();
          break;
        default:
          backupResult = await this.backupService.performFullBackup(backupName, true);
      }

      if (!backupResult.success) {
        throw new Error(backupResult.error || '备份失败');
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const newBackup: Backup = {
        id: Math.floor(Math.random() * 10000) + 100,
        backupCode: `BK${timestamp}`,
        backupName: backupName || `备份-${new Date().toLocaleDateString()}`,
        backupType: backupType || 1,
        backupMode: backupMode || 1,
        filePath: backupResult.filePath || '',
        fileSize: backupResult.fileSize || 0,
        fileUrl: `/api/v1/system/backups/download?file=${path.basename(backupResult.filePath || '')}`,
        status: 2, // 已完成
        remark: remark || backupResult.message,
        createdBy: "admin",
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString()
      };

      return successResponse(res, newBackup, '备份成功');
    } catch (error: any) {
      logger.error('创建备份失败:', error);
      return errorResponse(res, 400, error.message || '创建失败', null);
    }
  }

  async delete(req: Request, res: Response): Promise<Response> {
    try {
      const { fileName } = req.body;
        
      if (!fileName) {
        return errorResponse(res, 400, '文件名不能为空', null);
      }
  
      await this.backupService.deleteBackup(fileName);
      return successResponse(res, null, '删除成功');
    } catch (error: any) {
      logger.error('删除备份失败:', error);
      return errorResponse(res, 400, error.message || '删除失败', null);
    }
  }
  
  async getBackupList(req: Request, res: Response): Promise<Response> {
    try {
      const backups = await this.backupService.getBackupList();
      return successResponse(res, { items: backups, total: backups.length }, '获取备份列表成功');
    } catch (error: any) {
      logger.error('获取备份列表失败:', error);
      return errorResponse(res, 500, error.message || '获取失败', null);
    }
  }
  
  async cleanupOldBackups(req: Request, res: Response): Promise<Response> {
    try {
      const { daysToKeep } = req.body;
      const days = daysToKeep || 30; // 默认保留 30 天
        
      const deletedCount = await this.backupService.cleanupOldBackups(days);
      return successResponse(res, { deletedCount }, `已清理 ${deletedCount} 个旧备份文件`);
    } catch (error: any) {
      logger.error('清理旧备份失败:', error);
      return errorResponse(res, 400, error.message || '清理失败', null);
    }
  }
  
  async verifyBackup(req: Request, res: Response): Promise<Response> {
    try {
      const { fileName } = req.body;
        
      if (!fileName) {
        return errorResponse(res, 400, '文件名不能为空', null);
      }
  
      const filePath = path.join(process.env.BACKUP_PATH || './backups', fileName);
      const isValid = await this.backupService.verifyBackup(filePath);
        
      return successResponse(res, { valid: isValid, message: isValid ? '备份文件有效' : '备份文件无效或损坏' }, '验证完成');
    } catch (error: any) {
      logger.error('验证备份失败:', error);
      return errorResponse(res, 400, error.message || '验证失败', null);
    }
  }

  async restore(req: Request, res: Response): Promise<Response> {
    try {
      const { backupFile } = req.body;
        
      if (!backupFile) {
        return errorResponse(res, 400, '备份文件路径不能为空', null);
      }
  
      // 执行数据库恢复
      const result = await this.backupService.restoreDatabase(backupFile);
  
      if (!result.success) {
        throw new Error(result.error || '恢复失败');
      }
  
      return successResponse(res, { message: result.message }, '数据库恢复成功');
    } catch (error: any) {
      logger.error('数据库恢复失败:', error);
      return errorResponse(res, 400, error.message || '操作失败', null);
    }
  }

  async download(req: Request, res: Response): Promise<Response> {
    try {
      const { file } = req.query;
        
      if (!file) {
        return errorResponse(res, 400, '文件名不能为空', null);
      }
  
      const filePath = path.join(process.env.BACKUP_PATH || './backups', file as string);
        
      // 验证文件是否存在
      const fs = require('fs');
      if (!fs.existsSync(filePath)) {
        return errorResponse(res, 404, '备份文件不存在', null);
      }
  
      // 设置响应头，触发文件下载
      res.setHeader('Content-Disposition', `attachment; filename="${file}"`);
      res.setHeader('Content-Type', 'application/sql');
        
      const readStream = fs.createReadStream(filePath);
      readStream.pipe(res);
        
      return successResponse(res, null, '下载成功');
    } catch (error: any) {
      logger.error('下载备份文件失败:', error);
      return errorResponse(res, 400, error.message || '操作失败', null);
    }
  }
}

export default new BackupController();
