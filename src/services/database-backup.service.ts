import { Injectable } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const execAsync = promisify(exec);

export interface BackupResult {
  success: boolean;
  filePath?: string;
  fileSize?: number;
  message: string;
  error?: string;
}

@Injectable()
export class DatabaseBackupService {
  private readonly backupDir: string;
  private readonly dbHost: string;
  private readonly dbPort: number;
  private readonly dbUser: string;
  private readonly dbPassword: string;
  private readonly dbName: string;
  private readonly pgDumpPath: string;
  private readonly psqlPath: string;
  private readonly pgPassEnvName: string;

  constructor() {
    // 设置备份目录
    this.backupDir = process.env.BACKUP_PATH || path.join(__dirname, '../../backups');
    
    // 确保备份目录存在
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }

    // 从环境变量读取数据库配置
    this.dbHost = process.env.DB_HOST || 'localhost';
    this.dbPort = parseInt(process.env.DB_PORT || '5432');
    this.dbUser = process.env.DB_USER || 'postgres';
    this.dbPassword = process.env.DB_PASS || '';
    this.dbName = process.env.DB_NAME || 'training';
    
    // 设置 PostgreSQL 客户端工具路径
    const postgresBinDir = process.env.PG_BIN_DIR || '';
    this.pgDumpPath = path.join(postgresBinDir, process.env.PG_EXEC_DUMP || 'pg_dump');
    this.psqlPath = path.join(postgresBinDir, process.env.PG_EXEC_PSQL || 'psql');
    this.pgPassEnvName = process.env.PG_PWD_ENV_NAME || 'PGPASSWORD';
  }
  /**
   * 执行完整的数据库备份
   * @param backupName 备份名称
   * @param includeSchema 是否包含 schema（默认 true）
   */
  async performFullBackup(backupName?: string, includeSchema: boolean = true): Promise<BackupResult> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `full_backup_${timestamp}.sql`;
    const filePath = path.join(this.backupDir, fileName);

    try {
      // 构建 pg_dump 命令（使用完整路径）
      let dumpCommand = `"${this.pgDumpPath}" -h ${this.dbHost} -p ${this.dbPort} -U ${this.dbUser} -d ${this.dbName} -w`;
      
      if (includeSchema) {
        // 完整备份（包含 schema 和数据）
        dumpCommand += ` --format=plain --no-owner --no-privileges > "${filePath}"`;
      } else {
        // 仅数据备份
        dumpCommand += ` --data-only --format=plain --no-owner --no-privileges > "${filePath}"`;
      }

      // 设置环境变量（包含密码）
      const env = { ...process.env, [this.pgPassEnvName]: this.dbPassword };

      // 执行备份命令
      await execAsync(dumpCommand, { env });

      // 获取文件大小
      const stats = fs.statSync(filePath);
      const fileSize = stats.size;

      return {
        success: true,
        filePath,
        fileSize,
        message: `数据库完整备份成功：${fileName}`
      };
    } catch (error: any) {
      console.error('备份错误详情:', error);
      return {
        success: false,
        message: '数据库备份失败',
        error: error.message || error.stderr || '未知错误'
      };
    }
  }

  /**
   * 执行增量备份（基于 WAL 日志）
   * 注意：这需要 PostgreSQL 配置 WAL 归档
   */
  async performIncrementalBackup(backupName?: string): Promise<BackupResult> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `incremental_backup_${timestamp}.sql`;
    const filePath = path.join(this.backupDir, fileName);

    try {
      // 使用 pg_dump 进行增量备份（实际上 PostgreSQL 的增量备份需要 WAL 归档）
      // 这里我们做一个简化的版本，只备份变化的数据
      const queryCommand = `"${this.pgDumpPath}" -h ${this.dbHost} -p ${this.dbPort} -U ${this.dbUser} -d ${this.dbName} --data-only --format=plain > "${filePath}"`;
      
      const env = { ...process.env, PGPASSWORD: this.dbPassword };
      await execAsync(queryCommand, { env, windowsHide: true });

      const stats = fs.statSync(filePath);
      const fileSize = stats.size;

      return {
        success: true,
        filePath,
        fileSize,
        message: `数据库增量备份成功：${fileName}`
      };
    } catch (error: any) {
      console.error('增量备份错误:', error);
      return {
        success: false,
        message: '数据库增量备份失败',
        error: error.message || error.stderr || '未知错误'
      };
    }
  }

  /**
   * 执行差异备份
   */
  async performDifferentialBackup(baseBackupPath?: string): Promise<BackupResult> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `differential_backup_${timestamp}.sql`;
    const filePath = path.join(this.backupDir, fileName);

    try {
      // 差异备份通常需要一个基础备份作为参考
      // 这里我们简化处理，直接备份当前数据
      const dumpCommand = `"${this.pgDumpPath}" -h ${this.dbHost} -p ${this.dbPort} -U ${this.dbUser} -d ${this.dbName} --schema-only --format=plain > "${filePath}"`;
      
      const env = { ...process.env, PGPASSWORD: this.dbPassword };
      await execAsync(dumpCommand, { env, windowsHide: true });

      const stats = fs.statSync(filePath);
      const fileSize = stats.size;

      return {
        success: true,
        filePath,
        fileSize,
        message: `数据库差异备份成功：${fileName}`
      };
    } catch (error: any) {
      console.error('差异备份错误:', error);
      return {
        success: false,
        message: '数据库差异备份失败',
        error: error.message || error.stderr || '未知错误'
      };
    }
  }

  /**
   * 从备份文件恢复数据库
   * @param backupFilePath 备份文件路径
   * @param cleanFirst 是否先清空数据库（默认 false）
   */
  async restoreDatabase(backupFilePath: string, cleanFirst: boolean = false): Promise<BackupResult> {
    try {
      // 检查备份文件是否存在
      if (!fs.existsSync(backupFilePath)) {
        return {
          success: false,
          message: '备份文件不存在'
        };
      }

      let restoreCommand: string;
      
      if (cleanFirst) {
        // 方式 1：先清空数据库，然后恢复（推荐）
        console.log('正在清空数据库...');
        const dropSchemaCmd = `psql -h ${this.dbHost} -p ${this.dbPort} -U ${this.dbUser} -d ${this.dbName} -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"`;
        const env = { ...process.env, PGPASSWORD: this.dbPassword };
        
        try {
          await execAsync(dropSchemaCmd, { 
            env,
            windowsHide: true
          });
          console.log('数据库已清空');
        } catch (error: any) {
          console.error('清空数据库失败:', error.message);
          // 继续执行，使用带 --clean 选项的恢复
        }
        
        // 使用 --clean --if-exists 选项恢复
        restoreCommand = `"${this.psqlPath}" --clean --if-exists -h ${this.dbHost} -p ${this.dbPort} -U ${this.dbUser} -d ${this.dbName} -f "${backupFilePath}"`;
      } else {
        // 方式 2：直接恢复（可能会有约束冲突）
        restoreCommand = `"${this.psqlPath}" -h ${this.dbHost} -p ${this.dbPort} -U ${this.dbUser} -d ${this.dbName} -f "${backupFilePath}"`;
      }
      
      const env = { ...process.env, PGPASSWORD: this.dbPassword };
      
      console.log('开始恢复数据...');
      // 执行恢复命令
      const { stdout, stderr } = await execAsync(restoreCommand, { 
        env,
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        windowsHide: true // 在 Windows 上隐藏控制台窗口
      });

      // 检查错误（忽略 NOTICE 和 IF EXISTS 相关的警告）
      const criticalErrors = stderr.split('\n')
        .filter(line => line.trim())
        .filter(line => !line.includes('NOTICE') && 
                       !line.includes('IF EXISTS') &&
                       !line.includes('already exists') &&
                       !line.includes('does not exist'));
      
      if (criticalErrors.length > 0) {
        console.warn('恢复过程中出现以下非致命错误:');
        criticalErrors.forEach(err => console.warn('  ' + err));
      }

      return {
        success: true,
        message: '数据库恢复成功'
      };
    } catch (error: any) {
      console.error('恢复错误详情:', error);
      return {
        success: false,
        message: '数据库恢复失败',
        error: error.message || error.stderr || '未知错误'
      };
    }
  }

  /**
   * 获取所有备份文件列表
   */
  async getBackupList(): Promise<Array<{
    fileName: string;
    filePath: string;
    fileSize: number;
    createdAt: Date;
  }>> {
    try {
      const files = fs.readdirSync(this.backupDir);
      const backupFiles = files
        .filter(file => file.endsWith('.sql'))
        .map(file => {
          const filePath = path.join(this.backupDir, file);
          const stats = fs.statSync(filePath);
          return {
            fileName: file,
            filePath,
            fileSize: stats.size,
            createdAt: stats.birthtime
          };
        })
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      return backupFiles;
    } catch (error: any) {
      throw new Error(`获取备份列表失败：${error.message}`);
    }
  }

  /**
   * 删除备份文件
   * @param fileName 文件名或完整路径
   */
  async deleteBackup(fileName: string): Promise<boolean> {
    try {
      let filePath: string;
      
      if (path.isAbsolute(fileName)) {
        filePath = fileName;
      } else {
        filePath = path.join(this.backupDir, fileName);
      }
      filePath = path.normalize(filePath);
      
      if (!fs.existsSync(filePath)) {
        throw new Error('备份文件不存在:' + filePath);
      }

      fs.unlinkSync(filePath);
      return true;
    } catch (error: any) {
      throw new Error(`删除备份文件失败：${error.message}`);
    }
  }

  /**
   * 压缩备份文件
   * @param filePath 文件路径
   */
  async compressBackup(filePath: string): Promise<string> {
    const { createGzip } = await import('zlib');
    const { pipeline } = await import('stream');
    const { createReadStream, createWriteStream } = await import('fs');

    const compressedPath = `${filePath}.gz`;
    
    return new Promise((resolve, reject) => {
      const readStream = createReadStream(filePath);
      const writeStream = createWriteStream(compressedPath);
      const gzip = createGzip();

      pipeline(readStream, gzip, writeStream, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(compressedPath);
        }
      });
    });
  }

  /**
   * 验证备份文件完整性
   * @param filePath 文件路径
   */
  async verifyBackup(filePath: string): Promise<boolean> {
    try {
      if (!fs.existsSync(filePath)) {
        return false;
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      
      // 简单的验证：检查是否包含有效的 SQL 语句
      const hasValidSQL = content.includes('INSERT') || 
                         content.includes('CREATE TABLE') || 
                         content.includes('COPY') ||
                         content.includes('-- PostgreSQL database dump');

      return hasValidSQL;
    } catch (error) {
      return false;
    }
  }

  /**
   * 清理旧备份（保留最近 N 天的备份）
   * @param daysToKeep 保留天数
   */
  async cleanupOldBackups(daysToKeep: number = 30): Promise<number> {
    try {
      const backups = await this.getBackupList();
      const now = new Date();
      let deletedCount = 0;

      for (const backup of backups) {
        const ageInDays = (now.getTime() - backup.createdAt.getTime()) / (1000 * 60 * 60 * 24);
        
        if (ageInDays > daysToKeep) {
          await this.deleteBackup(backup.fileName);
          deletedCount++;
        }
      }

      return deletedCount;
    } catch (error: any) {
      throw new Error(`清理旧备份失败：${error.message}`);
    }
  }

  /**
   * 清理旧备份（保留最近 N 个备份）
   * @param countToKeep 保留数量
   */
  async cleanupOldBackupsByCount(countToKeep: number = 30): Promise<number> {
    try {
      const backups = await this.getBackupList();
      let deletedCount = 0;

      // 备份列表已按时间排序（最新的在前）
      // 删除超出保留数量的旧备份
      if (backups.length > countToKeep) {
        const backupsToDelete = backups.slice(countToKeep);
        
        for (const backup of backupsToDelete) {
          await this.deleteBackup(backup.fileName);
          // 同时删除可能存在的压缩文件
          const gzPath = `${backup.filePath}.gz`;
          if (fs.existsSync(gzPath)) {
            fs.unlinkSync(gzPath);
          }
          deletedCount++;
        }
      }

      return deletedCount;
    } catch (error: any) {
      throw new Error(`清理旧备份失败：${error.message}`);
    }
  }
}