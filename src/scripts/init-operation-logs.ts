import 'reflect-metadata';
import { AppDataSource } from '../config/database';
import { OperationLog } from '../models/operation-log.entity';
import { User } from '../models/user.entity';
import { CompanyInfo } from '../models/company-info.entity';

async function initOperationLogs() {
  try {
    console.log('开始初始化操作日志数据...');
    
    await AppDataSource.initialize();
    console.log('数据库连接成功');

    // 获取一个默认用户作为日志创建者
    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({ where: { username: 'admin' } }) || 
                 await userRepository.findOne({ where: { id: 1 } });

    if (!user) {
      console.log('未找到默认用户，跳过初始化');
      return;
    }

    const operationLogRepository = AppDataSource.getRepository(OperationLog);
    const existingCount = await operationLogRepository.count();
    
    if (existingCount > 0) {
      console.log('操作日志表中已存在数据，跳过初始化');
      return;
    }

    // 创建示例操作日志数据
    const sampleLogs = [
      {
        logCode: 'LOG202401010001',
        userId: user.id,
        userName: user.username,
        realName: user.name || '系统管理员',
        operationModule: '用户管理',
        operationType: 1,
        operationDesc: '新增用户',
        requestUrl: '/api/users',
        requestMethod: 'POST',
        requestParams: JSON.stringify({ username: 'testuser', realName: '测试用户' }),
        responseResult: JSON.stringify({ code: 200, message: '创建成功' }),
        clientIp: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        executionTime: 156,
        status: 1,
        remark: '用户创建成功',
        createdBy: user.id,
        updatedBy: user.id
      },
      {
        logCode: 'LOG202401010002',
        userId: user.id,
        userName: user.username,
        realName: user.name || '系统管理员',
        operationModule: '财务管理',
        operationType: 2,
        operationDesc: '修改财务数据',
        requestUrl: '/api/finance/update',
        requestMethod: 'PUT',
        requestParams: JSON.stringify({ id: 123, amount: 50000 }),
        responseResult: JSON.stringify({ code: 200, message: '更新成功' }),
        clientIp: '192.168.1.101',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        executionTime: 89,
        status: 1,
        remark: '财务数据更新',
        createdBy: user.id,
        updatedBy: user.id
      },
      {
        logCode: 'LOG202401010003',
        userId: user.id,
        userName: user.username,
        realName: user.name || '系统管理员',
        operationModule: '系统配置',
        operationType: 3,
        operationDesc: '删除配置项',
        requestUrl: '/api/config/delete/456',
        requestMethod: 'DELETE',
        requestParams: '',
        responseResult: JSON.stringify({ code: 500, message: '删除失败：系统配置不允许删除' }),
        clientIp: '192.168.1.102',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        executionTime: 45,
        status: 2,
        remark: '删除系统配置失败',
        createdBy: user.id,
        updatedBy: user.id
      },
      {
        logCode: 'LOG202401010004',
        userId: user.id,
        userName: user.username,
        realName: user.name || '系统管理员',
        operationModule: '报表管理',
        operationType: 5,
        operationDesc: '导出财务报表',
        requestUrl: '/api/report/export',
        requestMethod: 'GET',
        requestParams: JSON.stringify({ reportType: 'summary', startDate: '2024-01-01', endDate: '2024-03-31' }),
        responseResult: JSON.stringify({ code: 200, message: '导出成功', data: { fileName: '财务汇总报表_2024Q1.xlsx' }}),
        clientIp: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        executionTime: 1234,
        status: 1,
        remark: '季度财务报表导出',
        createdBy: user.id,
        updatedBy: user.id
      }
    ];

    for (const logData of sampleLogs) {
      const operationLog = new OperationLog();
      Object.assign(operationLog, logData);
      operationLog.operationTime = new Date();
      operationLog.createdAt = new Date();
      operationLog.updatedAt = new Date();

      await operationLogRepository.save(operationLog);
      console.log(`已创建操作日志: ${logData.logCode}`);
    }

    console.log('操作日志初始化完成！');
  } catch (error) {
    console.error('初始化操作日志时发生错误:', error);
  } finally {
    await AppDataSource.destroy();
  }
}

if (require.main === module) {
  initOperationLogs();
}