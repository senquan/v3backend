import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { DictController } from '../controllers/dict.controller';
import { BackupController } from '../controllers/backup.controller';

const router = Router();

const dictController = new DictController();
const backupController = new BackupController();

router.use(authMiddleware);

// 字典管理
router.get('/dicts', dictController.getAll);
router.get('/dicts/groups', dictController.getGroups);
router.get('/dicts/group/:group', dictController.getByGroup);
router.get('/dicts/group/:group/value/:value', dictController.getNameByValue);
router.get('/dicts/map/:group', dictController.getDictMap);
router.get('/dicts/:id', dictController.getById);
router.post('/dicts', dictController.create);
router.put('/dicts/:id', dictController.update);
router.delete('/dicts/:id', dictController.delete);

// 备份管理
router.get('/backups', backupController.getAll);
router.get('/backups/:id', backupController.getById);
router.post('/backups', backupController.create);
router.delete('/backups/:id', backupController.delete);
router.post('/backups/:id/restore', backupController.restore);
router.get('/backups/:id/download', backupController.download);

export default router;
