import { LogService, LogQuery } from '../services/log.service';
import { LogLevel, LogCategory } from '../models/system-log.model';
import { AppDataSource } from '../config/database';
import { SystemLog, LogChain } from '../models/system-log.model';

export class LogController {
  private logRepository = AppDataSource.getRepository(SystemLog);
  private chainRepository = AppDataSource.getRepository(LogChain);
  private logService = new LogService(this.logRepository, this.chainRepository);

  async queryLogs(query: LogQuery) {
    return this.logService.queryLogs(query);
  }

  async getStatistics(startDate?: Date, endDate?: Date) {
    return this.logService.getStatistics(startDate, endDate);
  }

  async verifyIntegrity(startSequence?: number, endSequence?: number) {
    return this.logService.verifyIntegrity(startSequence, endSequence);
  }

  async exportLogs(query: LogQuery) {
    return this.logService.exportLogs(query);
  }

  async cleanOldLogs(daysToKeep: number = 30) {
    return this.logService.cleanOldLogs(daysToKeep);
  }

  getCategories() {
    return Object.values(LogCategory);
  }

  getLevels() {
    return Object.values(LogLevel);
  }
}
