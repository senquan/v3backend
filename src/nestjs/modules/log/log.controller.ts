import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { LogService } from './log.service';
import { QueryLogDto, VerifyIntegrityDto, CleanLogsDto } from './dto/log.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LogLevel, LogCategory } from '../../../models/system-log.model';

@Controller('logs')
@UseGuards(JwtAuthGuard)
export class LogController {
  constructor(private readonly logService: LogService) {}

  @Get('query')
  async queryLogs(@Query() query: QueryLogDto) {
    const result = await this.logService.queryLogs(query);
    return {
      code: 0,
      message: '查询成功',
      data: result.data,
      total: result.total,
    };
  }

  @Get('statistics')
  async getStatistics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const result = await this.logService.getStatistics(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
    return {
      code: 0,
      message: '获取统计成功',
      data: result,
    };
  }

  @Get('verify')
  async verifyIntegrity(
    @Query('startSequence') startSequence?: string,
    @Query('endSequence') endSequence?: string,
  ) {
    const result = await this.logService.verifyIntegrity(
      startSequence ? parseInt(startSequence, 10) : undefined,
      endSequence ? parseInt(endSequence, 10) : undefined,
    );
    return {
      code: 0,
      message: '校验完成',
      data: result,
    };
  }

  @Get('export')
  async exportLogs(@Query() query: QueryLogDto) {
    const result = await this.logService.exportLogs(query);
    return {
      code: 0,
      message: '导出成功',
      data: result,
    };
  }

  @Post('clean')
  @HttpCode(HttpStatus.OK)
  async cleanOldLogs(@Body() body: CleanLogsDto) {
    const deleted = await this.logService.cleanOldLogs(body.daysToKeep || 30);
    return {
      code: 0,
      message: `已删除 ${deleted} 条旧日志`,
      data: { deleted },
    };
  }

  @Get('categories')
  getCategories() {
    return {
      code: 0,
      data: Object.values(LogCategory),
    };
  }

  @Get('levels')
  getLevels() {
    return {
      code: 0,
      data: Object.values(LogLevel),
    };
  }
}
