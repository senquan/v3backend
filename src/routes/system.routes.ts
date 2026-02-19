import { Router } from 'express';
import { DictService } from '../services/dict.service';
import { Dict } from '../models/dict.entity';
import { AppDataSource } from '../config/database';
import { RedisCacheService } from '../services/cache.service';

const router = Router();

const dictRepository = AppDataSource.getRepository(Dict);
const cacheService = new RedisCacheService();
const dictService = new DictService(dictRepository, cacheService);

router.get('/backups', (req, res) => {
  const { backupName, backupType, backupMode, status, startDate, endDate, page = 1, size = 10 } = req.query;
  const pageNum = parseInt(page as string);
  const pageSize = parseInt(size as string);
  const skip = (pageNum - 1) * pageSize;

  const mockData = [
    {
      id: 1,
      backupCode: "BK202401010001",
      backupName: "完整备份-20240101",
      backupType: 1,
      backupMode: 2,
      filePath: "/backups/bk_20240101.sql",
      fileSize: 52428800,
      fileUrl: "/api/v1/system/backups/1/download",
      status: 2,
      remark: "自动完整备份",
      createdBy: "system",
      createdAt: "2024-01-01T02:00:00Z",
      completedAt: "2024-01-01T02:05:30Z"
    },
    {
      id: 2,
      backupCode: "BK202401020001",
      backupName: "增量备份-20240102",
      backupType: 2,
      backupMode: 2,
      filePath: "/backups/bk_incr_20240102.sql",
      fileSize: 10485760,
      fileUrl: "/api/v1/system/backups/2/download",
      status: 2,
      remark: "自动增量备份",
      createdBy: "system",
      createdAt: "2024-01-02T02:00:00Z",
      completedAt: "2024-01-02T02:01:15Z"
    },
    {
      id: 3,
      backupCode: "BK202401030001",
      backupName: "手动备份-重要数据",
      backupType: 1,
      backupMode: 1,
      filePath: "/backups/bk_manual_20240103.sql",
      fileSize: 78643200,
      fileUrl: "/api/v1/system/backups/3/download",
      status: 2,
      remark: "手动备份重要业务数据",
      createdBy: "admin",
      createdAt: "2024-01-03T10:30:00Z",
      completedAt: "2024-01-03T10:45:20Z"
    },
    {
      id: 4,
      backupCode: "BK202401040001",
      backupName: "差异备份-20240104",
      backupType: 3,
      backupMode: 2,
      filePath: "/backups/bk_diff_20240104.sql",
      fileSize: 20971520,
      fileUrl: "/api/v1/system/backups/4/download",
      status: 1,
      remark: "自动差异备份",
      createdBy: "system",
      createdAt: "2024-01-04T02:00:00Z",
      completedAt: null
    }
  ];

  let filteredData = mockData;
  if (backupName) {
    filteredData = filteredData.filter(item => item.backupName.includes(backupName as string));
  }
  if (backupType) {
    filteredData = filteredData.filter(item => item.backupType === parseInt(backupType as string));
  }
  if (backupMode) {
    filteredData = filteredData.filter(item => item.backupMode === parseInt(backupMode as string));
  }
  if (status) {
    filteredData = filteredData.filter(item => item.status === parseInt(status as string));
  }

  const total = filteredData.length;
  const items = filteredData.slice(skip, skip + pageSize);

  res.json({
    code: 0,
    message: '查询成功',
    data: { items, total }
  });
});

router.post('/backups', (req, res) => {
  const { backupName, backupType, backupMode, remark } = req.body;
  
  const newBackup = {
    id: Math.floor(Math.random() * 10000) + 100,
    backupCode: `BK${new Date().getTime()}`,
    backupName: backupName || `备份-${new Date().toLocaleDateString()}`,
    backupType: backupType || 1,
    backupMode: backupMode || 1,
    filePath: "",
    fileSize: 0,
    fileUrl: "",
    status: 1,
    remark: remark || "",
    createdBy: "admin",
    createdAt: new Date().toISOString(),
    completedAt: null
  };

  res.json({
    code: 0,
    message: '备份任务已创建',
    data: newBackup
  });
});

router.get('/backups/:id', (req, res) => {
  const id = parseInt(req.params.id);
  
  const mockData = {
    id: 1,
    backupCode: "BK202401010001",
    backupName: "完整备份-20240101",
    backupType: 1,
    backupMode: 2,
    filePath: "/backups/bk_20240101.sql",
    fileSize: 52428800,
    fileUrl: "/api/v1/system/backups/1/download",
    status: 2,
    remark: "自动完整备份",
    createdBy: "system",
    createdAt: "2024-01-01T02:00:00Z",
    completedAt: "2024-01-01T02:05:30Z"
  };

  res.json({
    code: 0,
    message: '查询成功',
    data: mockData
  });
});

router.delete('/backups/:id', (req, res) => {
  const id = parseInt(req.params.id);
  
  res.json({
    code: 0,
    message: '删除成功',
    data: null
  });
});

router.post('/backups/:id/restore', (req, res) => {
  const id = parseInt(req.params.id);
  
  res.json({
    code: 0,
    message: '恢复任务已创建',
    data: null
  });
});

router.get('/backups/:id/download', (req, res) => {
  const id = parseInt(req.params.id);
  
  res.json({
    code: 0,
    message: '下载链接生成成功',
    data: {
      downloadUrl: `/uploads/backups/backup_${id}.sql`
    }
  });
});

router.get('/dicts', async (req, res) => {
  try {
    const { page = 1, size = 10, group, name, value } = req.query;
    const result = await dictService.findAll({
      page: parseInt(page as string),
      size: parseInt(size as string),
      group,
      name,
      value
    });
    res.json({
      code: 0,
      message: '查询成功',
      data: result
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: '查询失败',
      data: null
    });
  }
});

router.get('/dicts/groups', async (req, res) => {
  try {
    const groups = await dictService.getAllGroups();
    res.json({
      code: 0,
      message: '查询成功',
      data: groups
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: '查询失败',
      data: null
    });
  }
});

router.get('/dicts/group/:group', async (req, res) => {
  try {
    const group = parseInt(req.params.group);
    const items = await dictService.findByGroup(group);
    res.json({
      code: 0,
      message: '查询成功',
      data: items
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: '查询失败',
      data: null
    });
  }
});

router.get('/dicts/group/:group/value/:value', async (req, res) => {
  try {
    const group = parseInt(req.params.group);
    const value = req.params.value;
    const name = await dictService.getNameByValueFromCache(group, value);
    res.json({
      code: 0,
      message: '查询成功',
      data: name
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: '查询失败',
      data: null
    });
  }
});

router.get('/dicts/map/:group', async (req, res) => {
  try {
    const group = parseInt(req.params.group);
    const map = await dictService.getDictMap(group);
    const result: Record<string, string> = {};
    map.forEach((value, key) => {
      result[key] = value;
    });
    res.json({
      code: 0,
      message: '查询成功',
      data: result
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: '查询失败',
      data: null
    });
  }
});

router.get('/dicts/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const dict = await dictService.findOne(id);
    res.json({
      code: 0,
      message: '查询成功',
      data: dict
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: '查询失败',
      data: null
    });
  }
});

router.post('/dicts', async (req, res) => {
  try {
    const dict = await dictService.create(req.body);
    res.json({
      code: 0,
      message: '创建成功',
      data: dict
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: '创建失败',
      data: null
    });
  }
});

router.put('/dicts/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const dict = await dictService.update(id, req.body);
    res.json({
      code: 0,
      message: '更新成功',
      data: dict
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: '更新失败',
      data: null
    });
  }
});

router.delete('/dicts/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await dictService.remove(id);
    res.json({
      code: 0,
      message: '删除成功',
      data: null
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: '删除失败',
      data: null
    });
  }
});

export default router;
