import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LogController } from './log.controller';
import { LogService } from './log.service';
import { LogInterceptor } from './log.interceptor';
import { SystemLog, LogChain, LogArchive } from '../../../models/system-log.model';

@Module({
  imports: [TypeOrmModule.forFeature([SystemLog, LogChain, LogArchive])],
  controllers: [LogController],
  providers: [LogService, LogInterceptor],
  exports: [LogService, LogInterceptor],
})
export class LogModule {}
