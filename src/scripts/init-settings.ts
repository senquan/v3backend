import 'reflect-metadata';
import { AppDataSource } from '../config/database';
import { Settings } from '../models/settings.entity';

async function initSettings() {
  try {
    console.log('开始初始化系统配置数据...');
    
    await AppDataSource.initialize();
    console.log('数据库连接成功');

    const settingsRepository = AppDataSource.getRepository(Settings);
    const existingCount = await settingsRepository.count();
    
    if (existingCount > 0) {
      console.log('系统配置表中已存在数据，跳过初始化');
      return;
    }

    // 创建示例配置数据
    const sampleSettings = [
      {
        key: 'system_name',
        name: '系统名称',
        value: '财务管理系统',
        type: 1, // SYSTEM
        description: '系统显示名称',
        group: '基础配置',
        isSystem: 1, // 系统配置
        isEnabled: 1, // 启用
        sort: 1,
        createdBy: 1,
        updatedBy: 1
      },
      {
        key: 'max_upload_size',
        name: '最大上传文件大小',
        value: '10485760',
        type: 1, // SYSTEM
        description: '单位：字节',
        group: '文件配置',
        isSystem: 0, // 自定义配置
        isEnabled: 1, // 启用
        sort: 10,
        createdBy: 1,
        updatedBy: 1
      },
      {
        key: 'enable_notification',
        name: '启用通知功能',
        value: 'true',
        type: 1, // SYSTEM
        description: '是否启用系统通知',
        group: '功能配置',
        isSystem: 0, // 自定义配置
        isEnabled: 1, // 启用
        sort: 20,
        createdBy: 1,
        updatedBy: 1
      },
      {
        key: 'email_config',
        name: '邮件配置',
        value: JSON.stringify({
          host: 'smtp.example.com',
          port: 587,
          username: 'user@example.com',
          password: 'password'
        }),
        type: 3, // EMAIL
        description: '邮件服务器配置信息',
        group: '邮件配置',
        isSystem: 0, // 自定义配置
        isEnabled: 1, // 启用
        sort: 30,
        createdBy: 1,
        updatedBy: 1
      }
    ];

    for (const settingData of sampleSettings) {
      const setting = new Settings();
      Object.assign(setting, settingData);
      setting.createdAt = new Date();
      setting.updatedAt = new Date();
      setting.isDeleted = 0;

      await settingsRepository.save(setting);
      console.log(`已创建配置项: ${settingData.key}`);
    }

    console.log('系统配置初始化完成！');
  } catch (error) {
    console.error('初始化系统配置时发生错误:', error);
  } finally {
    await AppDataSource.destroy();
  }
}

if (require.main === module) {
  initSettings();
}