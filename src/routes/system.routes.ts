import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { DictController } from '../controllers/dict.controller';
import { BackupController } from '../controllers/backup.controller';
import { SettingsController } from '../controllers/settings.controller';

const router = Router();

const dictController = new DictController();
const settingsController = new SettingsController();
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

// 系统配置
router.get('/settings', settingsController.getSettingsList.bind(settingsController));
router.get('/settings/:id', settingsController.getSettingDetail.bind(settingsController));
router.post('/settings', settingsController.createSetting.bind(settingsController));
router.put('/settings/:id', settingsController.updateSetting.bind(settingsController));
router.delete('/settings/:id', settingsController.deleteSetting.bind(settingsController));
router.get('/settings/key/:key', settingsController.getSettingValue.bind(settingsController));
router.put('/settings/key/:key', settingsController.updateSettingValue.bind(settingsController));
router.get('/settings/group/:group', settingsController.getGroupedSettings.bind(settingsController));
router.get('/settings/options/types', settingsController.getSettingTypes.bind(settingsController));
router.get('/settings/options/system', settingsController.getSystemConfigOptions.bind(settingsController));
router.get('/settings/options/status', settingsController.getStatusOptions.bind(settingsController));

export default router;
