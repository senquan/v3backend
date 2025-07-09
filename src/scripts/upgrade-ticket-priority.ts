import { AppDataSource } from '../config/database';
import { Ticket } from '../models/ticket.model';
import { Notification } from '../models/notification.model';
import { Staff } from '../models/staff.model';
import { logger } from '../utils/logger';
import dotenv from 'dotenv';
import { MoreThan, In } from 'typeorm';

// 加载环境变量
dotenv.config();

// 优先级时效配置（小时）
const PRIORITY_TIMEOUTS = {
  1: 168, // 日常：168小时（7天）
  2: 48,  // 一般：48小时（2天）
  3: 24,  // 紧急：24小时（1天）
  4: 10,  // 加急：10小时
  5: 10   // 特急：10小时（超时后发送通知）
};

// 优先级名称映射
const PRIORITY_NAMES = {
  1: '日常',
  2: '一般', 
  3: '紧急',
  4: '加急',
  5: '特急'
};

class TicketPriorityUpgrader {
  private ticketRepository = AppDataSource.getRepository(Ticket);
  private notificationRepository = AppDataSource.getRepository(Notification);
  private staffRepository = AppDataSource.getRepository(Staff);

  /**
   * 主要处理逻辑
   */
  async process(): Promise<void> {
    try {
      logger.info('开始执行工单优先级升级任务...');
      
      // 获取所有待处理和处理中的工单
      const tickets = await this.ticketRepository.find({
        where: {
          status: In([1, 2]), // 1-待处理，2-处理中
          isDeleted: 0
        }
      });

      logger.info(`找到 ${tickets.length} 个需要检查的工单`);

      let upgradedCount = 0;
      let notificationCount = 0;

      for (const ticket of tickets) {
        const result = await this.processTicket(ticket);
        if (result.upgraded) {
          upgradedCount++;
        }
        if (result.notified) {
          notificationCount++;
        }
      }

      logger.info(`工单优先级升级任务完成：升级 ${upgradedCount} 个工单，发送 ${notificationCount} 个通知`);
    } catch (error) {
      logger.error(`工单优先级升级任务执行失败: ${error}`);
      throw error;
    }
  }

  /**
   * 处理单个工单
   */
  private async processTicket(ticket: Ticket): Promise<{ upgraded: boolean; notified: boolean }> {
    const now = new Date();
    const updateTime = new Date(ticket.updatedAt);
    const hoursPassed = (now.getTime() - updateTime.getTime()) / (1000 * 60 * 60);
    
    const timeoutHours = PRIORITY_TIMEOUTS[ticket.priority as keyof typeof PRIORITY_TIMEOUTS];
    
    if (hoursPassed >= timeoutHours) {
      if (ticket.priority === 5) {
        // 特急工单超时：发送通知并重置计时
        await this.handleUrgentTicketTimeout(ticket);
        return { upgraded: false, notified: true };
      } else {
        // 其他优先级：升级优先级
        await this.upgradeTicketPriority(ticket);
        return { upgraded: true, notified: false };
      }
    }

    return { upgraded: false, notified: false };
  }

  /**
   * 升级工单优先级
   */
  private async upgradeTicketPriority(ticket: Ticket): Promise<void> {
    const oldPriority = ticket.priority;
    const newPriority = Math.min(ticket.priority + 1, 5); // 最高为特急(5)
    
    if (newPriority > oldPriority) {
      ticket.priority = newPriority;
      ticket.updatedAt = new Date();
      
      await this.ticketRepository.save(ticket);
      
      logger.info(`工单 #${ticket.id} 优先级从 ${PRIORITY_NAMES[oldPriority as keyof typeof PRIORITY_NAMES]} 升级为 ${PRIORITY_NAMES[newPriority as keyof typeof PRIORITY_NAMES]}`);
      
      // 发送优先级升级通知给处理人
      if (ticket.assigneeId) {
        await this.sendPriorityUpgradeNotification(ticket, oldPriority, newPriority);
      }
    }
  }

  /**
   * 处理特急工单超时
   */
  private async handleUrgentTicketTimeout(ticket: Ticket): Promise<void> {
    // 重置更新时间，重新计时
    ticket.updatedAt = new Date();
    await this.ticketRepository.save(ticket);
    
    logger.info(`特急工单 #${ticket.id} 超时，已重置计时`);
    
    // 发送超时通知给处理人
    if (ticket.assigneeId) {
      await this.sendUrgentTimeoutNotification(ticket);
    }
  }

  /**
   * 发送优先级升级通知
   */
  private async sendPriorityUpgradeNotification(ticket: Ticket, oldPriority: number, newPriority: number): Promise<void> {
    // 通过staffId获取对应的userId
    const staff = await this.staffRepository.findOne({
      where: { id: ticket.assigneeId },
      relations: ['user']
    });
    
    if (!staff || !staff.userId) {
      logger.warn(`工单 #${ticket.id} 的处理人员 (staffId: ${ticket.assigneeId}) 未找到对应的用户账号，跳过通知发送`);
      return;
    }
    
    const notification = new Notification();
    notification.title = '工单优先级升级提醒';
    notification.description = `工单 #${ticket.id} "${ticket.title}" 的优先级已从 ${PRIORITY_NAMES[oldPriority as keyof typeof PRIORITY_NAMES]} 升级为 ${PRIORITY_NAMES[newPriority as keyof typeof PRIORITY_NAMES]}，请及时处理。`;
    notification.type = 'notification';
    notification.status = 'warning';
    notification.userId = staff.userId;
    notification.targetUrl = `/tickets/${ticket.id}`;
    notification.actionType = 'ticket_priority_upgrade';
    notification.actionData = JSON.stringify({ ticketId: ticket.id, oldPriority, newPriority });
    
    await this.notificationRepository.save(notification);
    
    logger.info(`已向员工 ${staff.name} (staffId: ${ticket.assigneeId}, userId: ${staff.userId}) 发送工单 #${ticket.id} 优先级升级通知`);
  }

  /**
   * 发送特急工单超时通知
   */
  private async sendUrgentTimeoutNotification(ticket: Ticket): Promise<void> {
    // 通过staffId获取对应的userId
    const staff = await this.staffRepository.findOne({
      where: { id: ticket.assigneeId },
      relations: ['user']
    });
    
    if (!staff || !staff.userId) {
      logger.warn(`工单 #${ticket.id} 的处理人员 (staffId: ${ticket.assigneeId}) 未找到对应的用户账号，跳过通知发送`);
      return;
    }
    
    const notification = new Notification();
    notification.title = '特急工单超时提醒';
    notification.description = `特急工单 #${ticket.id} "${ticket.title}" 已超过处理时效，请立即处理！计时已重置。`;
    notification.type = 'notification';
    notification.status = 'danger';
    notification.userId = staff.userId;
    notification.targetUrl = `/tickets/${ticket.id}`;
    notification.actionType = 'urgent_ticket_timeout';
    notification.actionData = JSON.stringify({ ticketId: ticket.id });
    
    await this.notificationRepository.save(notification);
    
    logger.info(`已向员工 ${staff.name} (staffId: ${ticket.assigneeId}, userId: ${staff.userId}) 发送特急工单 #${ticket.id} 超时通知`);
  }
}

async function main() {
  try {
    // 初始化数据库连接
    await AppDataSource.initialize();
    logger.info('数据库连接已建立');
    
    // 创建处理器实例
    const upgrader = new TicketPriorityUpgrader();
    
    // 执行优先级升级处理
    await upgrader.process();
    
    // 关闭数据库连接
    await AppDataSource.destroy();
    logger.info('数据库连接已关闭');
    
    process.exit(0);
  } catch (error) {
    logger.error(`脚本执行失败: ${error}`);
    process.exit(1);
  }
}

// 执行主函数
main();