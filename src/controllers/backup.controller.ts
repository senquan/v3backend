import { Request, Response } from 'express';
import { errorResponse, successResponse } from '../utils/response';
import { logger } from '../utils/logger';

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

const mockBackups: Backup[] = [
  {
    id: 1,
    backupCode: "BK202401010001",
    backupName: "完整备份-20240101",
    backupType: 1,
    backupMode: 2,
    filePath: "/backups/bk_20240101.sql",
    fileSize: 52428800,
    fileUrl: "/api/v1/system/backups/1/download",
    status: 2,
    remark: "自动完整备份",
    createdBy: "system",
    createdAt: "2024-01-01T02:00:00Z",
    completedAt: "2024-01-01T02:05:30Z"
  },
  {
    id: 2,
    backupCode: "BK202401020001",
    backupName: "增量备份-20240102",
    backupType: 2,
    backupMode: 2,
    filePath: "/backups/bk_incr_20240102.sql",
    fileSize: 10485760,
    fileUrl: "/api/v1/system/backups/2/download",
    status: 2,
    remark: "自动增量备份",
    createdBy: "system",
    createdAt: "2024-01-02T02:00:00Z",
    completedAt: "2024-01-02T02:01:15Z"
  },
  {
    id: 3,
    backupCode: "BK202401030001",
    backupName: "手动备份-重要数据",
    backupType: 1,
    backupMode: 1,
    filePath: "/backups/bk_manual_20240103.sql",
    fileSize: 78643200,
    fileUrl: "/api/v1/system/backups/3/download",
    status: 2,
    remark: "手动备份重要业务数据",
    createdBy: "admin",
    createdAt: "2024-01-03T10:30:00Z",
    completedAt: "2024-01-03T10:45:20Z"
  },
  {
    id: 4,
    backupCode: "BK202401040001",
    backupName: "差异备份-20240104",
    backupType: 3,
    backupMode: 2,
    filePath: "/backups/bk_diff_20240104.sql",
    fileSize: 20971520,
    fileUrl: "/api/v1/system/backups/4/download",
    status: 1,
    remark: "自动差异备份",
    createdBy: "system",
    createdAt: "2024-01-04T02:00:00Z",
    completedAt: null
  }
];

export class BackupController {
  async getAll(req: Request, res: Response): Promise<Response> {
    try {
      const { page = 1, size = 10, backupName, backupType, backupMode, status } = req.query;
      const pageNum = parseInt(page as string);
      const pageSize = parseInt(size as string);
      const skip = (pageNum - 1) * pageSize;

      let filteredData = [...mockBackups];
      if (backupName) {
        filteredData = filteredData.filter(item => item.backupName.includes(backupName as string));
      }
      if (backupType) {
        filteredData = filteredData.filter(item => item.backupType === parseInt(backupType as string));
      }
      if (backupMode) {
        filteredData = filteredData.filter(item => item.backupMode === parseInt(backupMode as string));
      }
      if (status) {
        filteredData = filteredData.filter(item => item.status === parseInt(status as string));
      }

      const total = filteredData.length;
      const items = filteredData.slice(skip, skip + pageSize);

      return successResponse(res, { items, total, page: pageNum, size: pageSize }, '查询成功');
    } catch (error) {
      logger.error('获取备份列表失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  async getById(req: Request, res: Response): Promise<Response> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return errorResponse(res, 400, '无效的备份ID', null);
      }

      const backup = mockBackups.find(item => item.id === id);
      if (!backup) {
        return errorResponse(res, 404, '备份不存在', null);
      }

      return successResponse(res, backup, '查询成功');
    } catch (error) {
      logger.error('获取备份详情失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  async create(req: Request, res: Response): Promise<Response> {
    try {
      const { backupName, backupType, backupMode, remark } = req.body;

      const newBackup: Backup = {
        id: Math.floor(Math.random() * 10000) + 100,
        backupCode: `BK${new Date().getTime()}`,
        backupName: backupName || `备份-${new Date().toLocaleDateString()}`,
        backupType: backupType || 1,
        backupMode: backupMode || 1,
        filePath: "",
        fileSize: 0,
        fileUrl: "",
        status: 1,
        remark: remark || "",
        createdBy: "admin",
        createdAt: new Date().toISOString(),
        completedAt: null
      };

      return successResponse(res, newBackup, '备份任务已创建');
    } catch (error: any) {
      logger.error('创建备份失败:', error);
      return errorResponse(res, 400, error.message || '创建失败', null);
    }
  }

  async delete(req: Request, res: Response): Promise<Response> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return errorResponse(res, 400, '无效的备份ID', null);
      }

      return successResponse(res, null, '删除成功');
    } catch (error: any) {
      logger.error('删除备份失败:', error);
      return errorResponse(res, 400, error.message || '删除失败', null);
    }
  }

  async restore(req: Request, res: Response): Promise<Response> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return errorResponse(res, 400, '无效的备份ID', null);
      }

      return successResponse(res, null, '恢复任务已创建');
    } catch (error: any) {
      logger.error('创建恢复任务失败:', error);
      return errorResponse(res, 400, error.message || '操作失败', null);
    }
  }

  async download(req: Request, res: Response): Promise<Response> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return errorResponse(res, 400, '无效的备份ID', null);
      }

      return successResponse(res, { downloadUrl: `/uploads/backups/backup_${id}.sql` }, '下载链接生成成功');
    } catch (error: any) {
      logger.error('生成下载链接失败:', error);
      return errorResponse(res, 400, error.message || '操作失败', null);
    }
  }
}

export default new BackupController();
