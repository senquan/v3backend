import { AppDataSource } from '../config/database';
import { Ticket } from '../models/ticket.model';
import { logger } from '../utils/logger';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

/**
 * 测试脚本：创建测试工单并验证优先级升级功能
 * 
 * 注意：assigneeId 使用的是 staffId，请确保数据库中存在对应的员工记录
 * 并且该员工有关联的用户账号，否则通知功能无法正常工作
 */
async function createTestTickets() {
  try {
    await AppDataSource.initialize();
    logger.info('数据库连接已建立');
    
    const ticketRepository = AppDataSource.getRepository(Ticket);
    
    // 创建测试工单
    const testTickets = [
      {
        title: '测试日常工单 - 超时168小时',
        content: '这是一个测试日常工单，用于验证优先级升级功能',
        ticketType: 1,
        priority: 1, // 日常
        status: 1, // 待处理
        creatorId: 1,
        assigneeId: 1,
        productId: 1,
        // 设置为8天前，超过168小时
        updatedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
      },
      {
        title: '测试一般工单 - 超时48小时',
        content: '这是一个测试一般工单，用于验证优先级升级功能',
        ticketType: 1,
        priority: 2, // 一般
        status: 1, // 待处理
        creatorId: 1,
        assigneeId: 1,
        productId: 1,
        // 设置为3天前，超过48小时
        updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
      },
      {
        title: '测试紧急工单 - 超时24小时',
        content: '这是一个测试紧急工单，用于验证优先级升级功能',
        ticketType: 1,
        priority: 3, // 紧急
        status: 1, // 待处理
        creatorId: 1,
        assigneeId: 1,
        productId: 1,
        // 设置为2天前，超过24小时
        updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      },
      {
        title: '测试加急工单 - 超时10小时',
        content: '这是一个测试加急工单，用于验证优先级升级功能',
        ticketType: 1,
        priority: 4, // 加急
        status: 1, // 待处理
        creatorId: 1,
        assigneeId: 1,
        productId: 1,
        // 设置为12小时前，超过10小时
        updatedAt: new Date(Date.now() - 12 * 60 * 60 * 1000)
      },
      {
        title: '测试特急工单 - 超时10小时',
        content: '这是一个测试特急工单，用于验证通知功能',
        ticketType: 1,
        priority: 5, // 特急
        status: 1, // 待处理
        creatorId: 1,
        assigneeId: 1,
        productId: 1,
        // 设置为12小时前，超过10小时
        updatedAt: new Date(Date.now() - 12 * 60 * 60 * 1000)
      }
    ];
    
    // 保存测试工单
    for (const ticketData of testTickets) {
      const ticket = ticketRepository.create(ticketData);
      await ticketRepository.save(ticket);
      logger.info(`创建测试工单: ${ticket.title} (ID: ${ticket.id})`);
    }
    
    logger.info(`成功创建 ${testTickets.length} 个测试工单`);
    
    await AppDataSource.destroy();
    logger.info('数据库连接已关闭');
    
  } catch (error) {
    logger.error(`创建测试工单失败: ${error}`);
    process.exit(1);
  }
}

/**
 * 清理测试工单
 */
async function cleanupTestTickets() {
  try {
    await AppDataSource.initialize();
    logger.info('数据库连接已建立');
    
    const ticketRepository = AppDataSource.getRepository(Ticket);
    
    // 删除标题包含"测试"的工单
    const testTickets = await ticketRepository.find({
      where: {
        title: 'Like' as any,
      }
    });
    
    // 使用原生查询删除测试工单
    const result = await ticketRepository
      .createQueryBuilder()
      .delete()
      .from(Ticket)
      .where('title LIKE :title', { title: '%测试%' })
      .execute();
    
    logger.info(`删除了 ${result.affected} 个测试工单`);
    
    await AppDataSource.destroy();
    logger.info('数据库连接已关闭');
    
  } catch (error) {
    logger.error(`清理测试工单失败: ${error}`);
    process.exit(1);
  }
}

/**
 * 查看当前工单状态
 */
async function viewTicketStatus() {
  try {
    await AppDataSource.initialize();
    logger.info('数据库连接已建立');
    
    const ticketRepository = AppDataSource.getRepository(Ticket);
    
    // 查询所有测试工单
    const tickets = await ticketRepository
      .createQueryBuilder('ticket')
      .where('ticket.title LIKE :title', { title: '%测试%' })
      .orderBy('ticket.priority', 'DESC')
      .addOrderBy('ticket.updatedAt', 'ASC')
      .getMany();
    
    logger.info(`找到 ${tickets.length} 个测试工单:`);
    
    const priorityNames = {
      1: '日常',
      2: '一般',
      3: '紧急', 
      4: '加急',
      5: '特急'
    };
    
    tickets.forEach(ticket => {
      const hoursSinceUpdate = (Date.now() - new Date(ticket.updatedAt).getTime()) / (1000 * 60 * 60);
      logger.info(`工单 #${ticket.id}: ${ticket.title}`);
      logger.info(`  优先级: ${priorityNames[ticket.priority as keyof typeof priorityNames]} (${ticket.priority})`);
      logger.info(`  更新时间: ${ticket.updatedAt}`);
      logger.info(`  距离更新: ${hoursSinceUpdate.toFixed(1)} 小时`);
      logger.info('---');
    });
    
    await AppDataSource.destroy();
    logger.info('数据库连接已关闭');
    
  } catch (error) {
    logger.error(`查看工单状态失败: ${error}`);
    process.exit(1);
  }
}

// 命令行参数处理
const command = process.argv[2];

switch (command) {
  case 'create':
    createTestTickets();
    break;
  case 'cleanup':
    cleanupTestTickets();
    break;
  case 'view':
    viewTicketStatus();
    break;
  default:
    console.log('使用方法:');
    console.log('  npm run test-ticket-priority create   - 创建测试工单');
    console.log('  npm run test-ticket-priority view     - 查看工单状态');
    console.log('  npm run test-ticket-priority cleanup  - 清理测试工单');
    console.log('');
    console.log('注意事项:');
    console.log('  - 测试工单的 assigneeId 设置为 1，请确保数据库中存在 staffId=1 的员工记录');
    console.log('  - 该员工需要有关联的用户账号，否则通知功能测试会失败');
    console.log('  - 建议在测试前先检查 staff 表和 user 表的关联关系');
    console.log('');
    console.log('测试流程:');
    console.log('  1. npm run test-ticket-priority create');
    console.log('  2. npm run test-ticket-priority view');
    console.log('  3. npm run upgrade-ticket-priority');
    console.log('  4. npm run test-ticket-priority view');
    console.log('  5. npm run test-ticket-priority cleanup');
    break;
}