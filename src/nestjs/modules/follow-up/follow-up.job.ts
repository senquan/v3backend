import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TicketFollowUpConfig } from '../../../models/ticket-follow-up-config.model';
import { TicketFollowUpRecord, FollowUpRecordStatus } from '../../../models/ticket-follow-up-record.model';
import { Order } from '../../../models/order.model';
import { Ticket } from '../../../models/ticket.model';
import { TicketComment } from '../../../models/ticket-comment.model';
import { Staff } from '../../../models/staff.model';
import { Notification } from '../../../models/notification.model';

@Injectable()
export class FollowUpReminderJob {
  private readonly logger = new Logger(FollowUpReminderJob.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /**
   * 每 10 分钟执行一次跟单提醒检查
   */
  @Cron('*/10 * * * *')
  async checkFollowUpReminders() {
    this.logger.log('开始检查跟单提醒...');

    try {
      // 第一步：扫描新订单，生成跟单记录
      await this.generateRecordsForNewOrders();

      // 第二步：处理已到触发时间的跟单记录
      await this.processTriggeredRecords();

      this.logger.log('跟单提醒检查完成');
    } catch (error) {
      this.logger.error('跟单提醒检查失败:', error);
    }
  }

  /**
   * 为即将到达首次触发时间的订单生成跟单记录
   */
  private async generateRecordsForNewOrders() {
    const configRepo = this.dataSource.getRepository(TicketFollowUpConfig);
    const orderRepo = this.dataSource.getRepository(Order);
    const recordRepo = this.dataSource.getRepository(TicketFollowUpRecord);

    // 获取所有启用的配置
    const activeConfigs = await configRepo.find({
      where: { isActive: 1 },
      relations: ['stages']
    });

    if (activeConfigs.length === 0) return;

    for (const config of activeConfigs) {
      try {
        const baseHours = Number(config.baseHours);

        // 查找触发时间已到达（created_at + baseHours <= NOW）且状态为待处理（未成交）的订单
        // 下界用 NOW()-15min 避免捞到过早的记录，上界用 NOW() 表示触发时间已到
        const queryBuilder = orderRepo.createQueryBuilder('order')
          .where('order.is_deleted = 0')
          .andWhere('order.status = 0') // PENDING 待处理 = 未成交
          .andWhere(`DATE_ADD(order.created_at, INTERVAL ${baseHours} HOUR) <= NOW()`)
          .andWhere(`DATE_ADD(order.created_at, INTERVAL ${baseHours} HOUR) >= DATE_SUB(NOW(), INTERVAL 15 MINUTE)`);

        // 按平台过滤
        if (config.platformId) {
          queryBuilder.andWhere('order.platform_id = :platformId', { platformId: config.platformId });
        }

        // 排除已有跟单记录的订单
        const existingOrderIds = await recordRepo.createQueryBuilder('record')
          .select('DISTINCT record.order_id')
          .where('record.config_id = :configId', { configId: config.id })
          .getRawMany();

        if (existingOrderIds.length > 0) {
          queryBuilder.andWhere('order.id NOT IN (:...existingIds)', {
            existingIds: existingOrderIds.map(r => r.order_id)
          });
        }

        const newOrders = await queryBuilder.getMany();

        if (newOrders.length === 0) continue;

        // 为每个订单生成全部阶段的跟单记录
        const sortedStages = [...config.stages].sort((a, b) => a.stageOrder - b.stageOrder);

        // 使用 MySQL DATE_ADD 计算 trigger_at，避免 JS Date 时区偏移
        for (const order of newOrders) {
          for (const stage of sortedStages) {
            await this.dataSource.query(
              `INSERT INTO ticket_follow_up_records (order_id, config_id, stage_id, stage_order, status, trigger_at, created_at)
               VALUES (?, ?, ?, ?, ?, DATE_ADD((SELECT created_at FROM orders WHERE id = ?), INTERVAL ? HOUR), NOW())`,
              [order.id, config.id, stage.id, stage.stageOrder, FollowUpRecordStatus.PENDING, order.id, Number(stage.cumulativeHours)]
            );
          }
          this.logger.log(`为订单 ${order.id} 生成 ${sortedStages.length} 条跟单记录`);
        }
      } catch (error) {
        this.logger.error(`处理配置 ${config.id} 生成记录失败:`, error);
      }
    }
  }

  /**
   * 处理已到触发时间的跟单记录
   */
  private async processTriggeredRecords() {
    const recordRepo = this.dataSource.getRepository(TicketFollowUpRecord);
    const orderRepo = this.dataSource.getRepository(Order);
    const ticketRepo = this.dataSource.getRepository(Ticket);
    const commentRepo = this.dataSource.getRepository(TicketComment);
    const staffRepo = this.dataSource.getRepository(Staff);

    // 查询待触发且已到触发时间的记录（使用 MySQL NOW() 避免时区问题）
    const pendingRecords = await recordRepo.createQueryBuilder('record')
      .leftJoinAndSelect('record.stage', 'stage')
      .leftJoinAndSelect('record.config', 'config')
      .where('record.status = :status', { status: FollowUpRecordStatus.PENDING })
      .andWhere('record.trigger_at <= NOW()')
      .orderBy('record.trigger_at', 'ASC')
      .limit(50) // 每次最多处理 50 条
      .getMany();

    if (pendingRecords.length === 0) return;

    for (const record of pendingRecords) {
      try {
        // 检查订单状态
        const order = await orderRepo.findOne({ where: { id: record.orderId } });
        if (!order) {
          record.status = FollowUpRecordStatus.SKIPPED;
          await recordRepo.save(record);
          continue;
        }

        // 如果订单已成交（status >= PAID 且不是已取消），跳过当前及后续阶段
        if (order.status >= 1 && order.status !== 7) {
          // 跳过当前记录
          record.status = FollowUpRecordStatus.SKIPPED;
          await recordRepo.save(record);

          // 跳过同一订单的后续待触发记录
          await recordRepo.createQueryBuilder()
            .update(TicketFollowUpRecord)
            .set({ status: FollowUpRecordStatus.SKIPPED })
            .where('order_id = :orderId', { orderId: order.id })
            .andWhere('config_id = :configId', { configId: record.configId })
            .andWhere('stage_order > :stageOrder', { stageOrder: record.stageOrder })
            .andWhere('status = :status', { status: FollowUpRecordStatus.PENDING })
            .execute();

          this.logger.log(`订单 ${order.id} 已成交，跳过跟单记录 ${record.id}`);
          continue;
        }

        // 如果订单已取消，跳过
        if (order.status === 7) {
          record.status = FollowUpRecordStatus.SKIPPED;
          await recordRepo.save(record);
          continue;
        }

        // 查找订单制单人对应的 Staff
        let assigneeId: number | undefined;
        if (order.userId) {
          const staff = await staffRepo.findOne({
            where: { userId: order.userId, isDeleted: 0 }
          });
          if (staff) {
            assigneeId = staff.id;
          }
        }

        // 创建跟单工单（ticketType=10）
        const ticket = new Ticket();
        ticket.title = `订单${order.name} - 第${record.stageOrder}轮`;
        ticket.content = this.buildTicketContent(order, record);
        ticket.ticketType = 10; // 跟单提醒
        ticket.priority = Math.min(2 + record.stageOrder, 5); // 随阶段递增
        ticket.status = 1; // 待处理
        ticket.creatorId = order.userId || 1;
        if (assigneeId) ticket.assigneeId = assigneeId;
        ticket.orderId = order.id;

        const savedTicket = await ticketRepo.save(ticket);

        // 创建系统评论，附带话术内容
        const comment = new TicketComment();
        comment.ticketId = savedTicket.id;
        comment.userId = order.userId || 1;
        comment.content = `[跟单话术 - ${record.stage.scriptName}]\n${record.stage.script}`;
        await commentRepo.save(comment);

        // 更新跟单记录
        record.status = FollowUpRecordStatus.TRIGGERED;
        record.ticketId = savedTicket.id;
        await recordRepo.save(record);

        // 发送通知
        if (assigneeId) {
          await this.sendTicketNotification(savedTicket, assigneeId);
        }

        this.logger.log(`订单 ${order.id} 第${record.stageOrder}轮跟单：创建工单 ${savedTicket.id}`);
      } catch (error) {
        this.logger.error(`处理跟单记录 ${record.id} 失败:`, error);
      }
    }
  }

  /**
   * 创建跟单通知（直接使用 NestJS DataSource，避免依赖 Express 的 NotificationService）
   */
  private async sendTicketNotification(ticket: Ticket, assigneeId: number) {
    try {
      const staffRepo = this.dataSource.getRepository(Staff);
      const staff = await staffRepo.findOne({ where: { id: assigneeId }, relations: ['user'] });
      if (!staff?.user) return;

      const notificationRepo = this.dataSource.getRepository(Notification);
      const notification = notificationRepo.create({
        title: `新跟单提醒：${ticket.title}`,
        description: `请查看跟单话术并发送给客户`,
        extra: `#${ticket.id}`,
        status: 'warning',
        type: 'todo',
        userId: staff.user.id,
        targetUrl: `/ticket/detail/${ticket.id}`,
        actionType: 'ticket_assigned',
        actionData: JSON.stringify({ ticketId: ticket.id, assigneeId })
      });
      await notificationRepo.save(notification);
      this.logger.log(`为工单 ${ticket.id} 创建通知成功，通知用户: ${staff.user.id}`);
    } catch (error) {
      this.logger.warn(`创建跟单通知失败（不影响主流程）:`, error);
    }
  }

  private buildTicketContent(order: Order, record: TicketFollowUpRecord): string {
    return [
      `## 跟单提醒`,
      ``,
      `**订单信息**：${order.name}`,
      `**算单时间**：${new Date(order.createdAt).toLocaleString('zh-CN')}`,
      `**当前轮次**：第 ${record.stageOrder} 轮`,
      `**话术名称**：${record.stage.scriptName}`,
      ``,
      `---`,
      ``,
      `请复制下方话术内容发送给客户，发送完毕后点击"完成跟单"按钮。`,
    ].join('\n');
  }
}

