#!/usr/bin/env node

/**
 * =============================================================================
 * 数据库自动备份任务脚本 (Node.js版本)
 * =============================================================================
 * 功能：
 *   1. 读取 .env 文件中的备份配置
 *   2. 根据 BACKUP_ENABLED 判断是否执行备份
 *   3. 执行数据库完整备份
 *   4. 根据 BACKUP_KEEP_COUNT 限制删除最早的备份文件
 * =============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';
import { DatabaseBackupService } from '../services/database-backup.service';

// 加载环境变量
const envPath = path.join(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach((line) => {
    const trimmedLine = line.trim();
    // 跳过注释和空行
    if (trimmedLine.startsWith('#') || !trimmedLine) return;
    
    const equalIndex = trimmedLine.indexOf('=');
    if (equalIndex > 0) {
      const key = trimmedLine.substring(0, equalIndex).trim();
      let value = trimmedLine.substring(equalIndex + 1).trim();
      // 去除引号
      value = value.replace(/^["']|["']$/g, '');
      process.env[key] = value;
    }
  });
  console.log(`✓ 已加载环境变量: ${envPath}`);
} else {
  console.error(`✗ 错误: 未找到 .env 文件: ${envPath}`);
  process.exit(1);
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  // 检查备份是否启用
  const backupEnabled = process.env.BACKUP_ENABLED === 'true' || process.env.BACKUP_ENABLED === '1';
  if (!backupEnabled) {
    console.log(`✗ 备份未启用 (BACKUP_ENABLED=${process.env.BACKUP_ENABLED})，跳过备份任务`);
    process.exit(0);
  }

  console.log('========================================');
  console.log('数据库自动备份任务开始');
  console.log('========================================');
  console.log(`时间: ${new Date().toLocaleString('zh-CN')}`);
  console.log('');

  // 备份配置
  const backupPath = process.env.BACKUP_PATH || path.join(__dirname, '../../backups');
  const keepCount = parseInt(process.env.BACKUP_KEEP_COUNT || '30', 10);

  console.log('备份配置:');
  console.log(`  - 数据库: ${process.env.DB_NAME}@${process.env.DB_HOST}:${process.env.DB_PORT}`);
  console.log(`  - 备份目录: ${backupPath}`);
  console.log(`  - 保留数量: ${keepCount}`);
  console.log('');

  // 确保备份目录存在
  if (!fs.existsSync(backupPath)) {
    fs.mkdirSync(backupPath, { recursive: true });
  }

  // 创建备份服务实例
  const backupService = new DatabaseBackupService();

  // =============================================================================
  // 执行备份
  // =============================================================================

  console.log('开始执行备份...');
  
  const result = await backupService.performFullBackup(undefined, true);

  if (!result.success) {
    console.error('✗ 备份失败');
    console.error(`  错误: ${result.error}`);
    process.exit(1);
  }

  const fileName = path.basename(result.filePath!);
  const fileSize = formatFileSize(result.fileSize || 0);

  console.log(`✓ 备份成功: ${fileName}`);
  console.log(`  文件大小: ${fileSize}`);
  console.log(`  文件路径: ${result.filePath}`);
  console.log('');

  // =============================================================================
  // 清理旧备份（根据 BACKUP_KEEP_COUNT）
  // =============================================================================

  console.log('清理旧备份文件...');
  console.log(`  保留数量限制: ${keepCount}`);

  try {
    const deletedCount = await backupService.cleanupOldBackupsByCount(keepCount);
    if (deletedCount > 0) {
      console.log(`✓ 已清理 ${deletedCount} 个旧备份文件`);
    } else {
      console.log('✓ 备份文件数量在限制范围内，无需清理');
    }
  } catch (error: any) {
    console.error(`✗ 清理旧备份失败: ${error.message}`);
  }

  console.log('');

  // =============================================================================
  // 备份完成
  // =============================================================================

  console.log('========================================');
  console.log('数据库自动备份任务完成');
  console.log('========================================');
  console.log(`时间: ${new Date().toLocaleString('zh-CN')}`);
  console.log(`备份文件: ${fileName}`);
  console.log(`文件大小: ${fileSize}`);
  console.log('');
}

/**
 * 格式化文件大小
 * @param bytes 字节数
 * @returns 格式化后的字符串
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${units[i]}`;
}

// 运行主函数
main().catch((error) => {
  console.error('✗ 备份任务执行失败:', error);
  process.exit(1);
});
