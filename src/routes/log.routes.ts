import { Router, Request, Response } from 'express';
import { LogService, LogQuery } from '../services/log.service';
import { LogLevel, LogCategory } from '../models/system-log.model';
import { AppDataSource } from '../config/database';
import { SystemLog, LogChain } from '../models/system-log.model';

const router = Router();

const logRepository = AppDataSource.getRepository(SystemLog);
const chainRepository = AppDataSource.getRepository(LogChain);
const logService = new LogService(logRepository, chainRepository);

router.get('/query', async (req: Request, res: Response) => {
  try {
    const { level, category, startDate, endDate, userId, traceId, keyword, page, pageSize } = req.query;

    const query: LogQuery = {
      level: level as LogLevel,
      category: category as LogCategory,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      userId: Number(userId || 0) || undefined,
      traceId: traceId as string,
      keyword: keyword as string,
      page: page ? parseInt(page as string, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize as string, 10) : 50,
    };

    const result = await logService.queryLogs(query);
    res.json({ code: 0, data: {
      list: result.data.list,
      total: result.data.total,
    }});
  } catch (error: any) {
    res.status(500).json({ code: -1, message: error.message });
  }
});

router.get('/statistics', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const result = await logService.getStatistics(
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined,
    );
    res.json({ code: 0, data: result });
  } catch (error: any) {
    res.status(500).json({ code: -1, message: error.message });
  }
});

router.get('/verify', async (req: Request, res: Response) => {
  try {
    const { startSequence, endSequence } = req.query;
    const result = await logService.verifyIntegrity(
      startSequence ? parseInt(startSequence as string, 10) : undefined,
      endSequence ? parseInt(endSequence as string, 10) : undefined,
    );
    res.json({ code: 0, data: result });
  } catch (error: any) {
    res.status(500).json({ code: -1, message: error.message });
  }
});

router.get('/export', async (req: Request, res: Response) => {
  try {
    const { level, category, startDate, endDate, userId, traceId, keyword } = req.query;

    const query: LogQuery = {
      level: level as LogLevel,
      category: category as LogCategory,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      userId: Number(userId || 0) || undefined,
      traceId: traceId as string,
      keyword: keyword as string,
    };

    const result = await logService.exportLogs(query);
    res.json({ code: 0, data: result });
  } catch (error: any) {
    res.status(500).json({ code: -1, message: error.message });
  }
});

router.post('/clean', async (req: Request, res: Response) => {
  try {
    const { daysToKeep } = req.body;
    const deleted = await logService.cleanOldLogs(daysToKeep || 30);
    res.json({ code: 0, data: { deleted }, message: `Deleted ${deleted} old log entries` });
  } catch (error: any) {
    res.status(500).json({ code: -1, message: error.message });
  }
});

router.get('/categories', (req: Request, res: Response) => {
  res.json({ code: 0, data: Object.values(LogCategory) });
});

router.get('/levels', (req: Request, res: Response) => {
  res.json({ code: 0, data: Object.values(LogLevel) });
});

export default router;
