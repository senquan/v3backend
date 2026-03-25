import { Cron, CronExpression } from '@nestjs/schedule';
import { Injectable, Logger } from '@nestjs/common';
import { shortLinkService } from '../services/short-link.service';

/**
 * 清理过期短链接的定时任务
 * 每天凌晨2点执行一次
 */
@Injectable()
export class CleanExpiredLinksJob {
  private readonly logger = new Logger(CleanExpiredLinksJob.name);

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleCron() {
    this.logger.log('开始清理过期短链接...');

    try {
      const count = await shortLinkService.cleanExpiredLinks();
      this.logger.log(`清理完成，共清理 ${count} 条过期短链接`);
    } catch (error) {
      this.logger.error('清理过期短链接失败:', error);
    }
  }
}
