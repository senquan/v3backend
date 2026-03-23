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
  fileName: string // 添加 fileName 字段
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
        fileName: file.fileName,
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
        fileName: file.fileName,
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

  async getConfig(req: Request, res: Response): Promise<Response> {
    
    return successResponse(res, {
      enable: process.env.BACKUP_ENABLED === 'true',
      frequency: process.env.BACKUP_FREQUENCY,
      weekday: process.env.BACKUP_WEEKDAY,
      day: process.env.BACKUP_DAY,
      keepCount: process.env.BACKUP_KEEP_COUNT
    }, '配置文件读取成功');
  }

  async create(req: Request, res: Response): Promise<Response> {
    try {
      const { backupName, backupType, backupMode, remark } = req.body;

      const userId = (req as any).user?.id;
      if (!userId) {
        return errorResponse(res, 400, '未授权', null);
      }
      
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
        fileName: path.basename(backupResult.filePath || ''),
        filePath: backupResult.filePath || '',
        fileSize: backupResult.fileSize || 0,
        fileUrl: `/system/backups/download?file=${path.basename(backupResult.filePath || '')}`,
        status: 2, // 已完成
        remark: remark || backupResult.message,
        createdBy: userId,
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

      logger.info('删除备份文件，参数 fileName:', fileName);
  
      await this.backupService.deleteBackup(fileName);
      return successResponse(res, null, '删除成功');
    } catch (error: any) {
      logger.error('删除备份失败:', error);
      return errorResponse(res, 400, error.message || '删除失败', null);
    }
  }
  
  async getBackupList(_req: Request, res: Response): Promise<Response> {
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

      // 获取文件信息
      const stats = fs.statSync(filePath);
      const fileName = path.basename(filePath);
      
      // 设置响应头，触发文件下载
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
      res.setHeader('Content-Type', 'application/sql');
      res.setHeader('Content-Length', stats.size);
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      // 创建可读流并管道到响应
      const readStream = fs.createReadStream(filePath);
      
      // 处理流错误
      readStream.on('error', (error: Error) => {
        logger.error('文件流读取错误:', error);
        if (!res.headersSent) {
          res.status(500).json({ code: 500, message: '文件读取失败', data: null });
        }
      });
      
      // 管道到响应
      readStream.pipe(res);
      
      // 返回一个空的 Promise，因为响应已经通过流发送
      return new Promise(() => {});
    } catch (error: any) {
      logger.error('下载备份文件失败:', error);
      return errorResponse(res, 400, error.message || '操作失败', null);
    }
  }

  async config(req: Request, res: Response): Promise<Response> {
    try {
      const { enable, frequency, weekday, day, keepCount } = req.body;

      // 读取当前 .env 文件内容
      const fs = require('fs');
      const path = require('path');
      const envPath = path.join(process.cwd(), '.env');
      
      if (!fs.existsSync(envPath)) {
        throw new Error('.env 文件不存在');
      }

      let envContent = fs.readFileSync(envPath, 'utf8');

      // 转换 enable 为布尔值字符串
      const enableValue = enable !== undefined ? (enable ? 'true' : 'false') : undefined;
      const weekdayValue = weekday !== undefined ? weekday.toString() : undefined;
      const dayValue = day !== undefined ? day.toString() : undefined;
      const keepCountValue = keepCount !== undefined ? keepCount.toString() : undefined;

      // 更新备份配置的函数
      const updateEnvVariable = (key: string, value: string | undefined) => {
        if (value === undefined) return;

        const regex = new RegExp(`^${key}=.*`, 'm');
        if (regex.test(envContent)) {
          // 替换现有配置
          envContent = envContent.replace(regex, `${key}=${value}`);
        } else {
          // 如果不存在，在备份设置区域添加
          const backupSectionIndex = envContent.indexOf('# 备份设置');
          if (backupSectionIndex !== -1) {
            // 找到备份设置区域的下一行开始位置
            const nextLineIndex = envContent.indexOf('\n', backupSectionIndex) + 1;
            if (nextLineIndex > 0) {
              envContent = envContent.slice(0, nextLineIndex) + `${key}=${value}\n` + envContent.slice(nextLineIndex);
            } else {
              envContent += `${key}=${value}\n`;
            }
          } else {
            // 如果没有备份设置区域，在文件末尾添加
            envContent += `\n# 备份设置\n${key}=${value}\n`;
          }
        }
      };

      // 处理频率相关配置
      if (frequency !== undefined) {
        // 如果设置为每天（频率=1），清除 WEEKDAY 和 DAY 设置
        if (frequency === 1) {
          // 每天备份，不需要特定的星期几或日期
          const regexWeekday = new RegExp(`^BACKUP_WEEKDAY=.*`, 'm');
          const regexDay = new RegExp(`^BACKUP_DAY=.*`, 'm');
          if (regexWeekday.test(envContent)) {
            envContent = envContent.replace(regexWeekday, '');
          }
          if (regexDay.test(envContent)) {
            envContent = envContent.replace(regexDay, '');
          }
        }
        // 如果设置为每周（频率=2），确保有 weekday 设置
        else if (frequency === 2) {
          if (weekdayValue === undefined) {
            // 如果没有提供 weekday，使用默认值
            updateEnvVariable('BACKUP_WEEKDAY', '1');
          }
        }
        // 如果设置为每月（频率=3），确保有 day 设置
        else if (frequency === 3) {
          if (dayValue === undefined) {
            // 如果没有提供 day，使用默认值
            updateEnvVariable('BACKUP_DAY', '1');
          }
        }
      }


      // 更新所有配置
      if (enableValue !== undefined) updateEnvVariable('BACKUP_ENABLED', enableValue);
      if (frequency !== undefined) updateEnvVariable('BACKUP_FREQUENCY', frequency);
      if (weekdayValue !== undefined) updateEnvVariable('BACKUP_WEEKDAY', weekdayValue);
      if (dayValue !== undefined) updateEnvVariable('BACKUP_DAY', dayValue);
      if (keepCountValue !== undefined) updateEnvVariable('BACKUP_KEEP_COUNT', keepCountValue);

      // 写入更新后的 .env 文件
      fs.writeFileSync(envPath, envContent, 'utf8');

      // 更新环境变量（当前进程）
      if (enableValue !== undefined) process.env.BACKUP_ENABLED = enableValue;
      if (frequency !== undefined) process.env.BACKUP_FREQUENCY = frequency;
      if (weekdayValue !== undefined) process.env.BACKUP_WEEKDAY = weekdayValue;
      if (dayValue !== undefined) process.env.BACKUP_DAY = dayValue;
      if (keepCountValue !== undefined) process.env.BACKUP_KEEP_COUNT = keepCountValue;

      logger.info('备份配置已更新', { 
        enable: enableValue, 
        weekday: weekdayValue, 
        day: dayValue, 
        keepCount: keepCountValue,
        frequency 
      });

      return successResponse(res, { 
        message: '配置更新成功',
        config: {
          enable: enableValue !== undefined ? enableValue === 'true' : process.env.BACKUP_ENABLED === 'true',
          frequency: frequency !== undefined ? parseInt(frequency) : parseInt(process.env.BACKUP_FREQUENCY || '1'),
          weekday: weekdayValue !== undefined ? parseInt(weekdayValue) : parseInt(process.env.BACKUP_WEEKDAY || '1'),
          day: dayValue !== undefined ? parseInt(dayValue) : parseInt(process.env.BACKUP_DAY || '1'),
          keepCount: keepCountValue !== undefined ? parseInt(keepCountValue) : parseInt(process.env.BACKUP_KEEP_COUNT || '30')
        }
      }, '配置更新成功');
    } catch (error: any) {
      logger.error('配置更新失败:', error);
      return errorResponse(res, 400, error.message || '操作失败', null);
    }
  }
}

export default new BackupController();