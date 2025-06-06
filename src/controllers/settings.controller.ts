import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Settings, SettingType } from '../models/settings.model';
import { errorResponse, successResponse } from '../utils/response';
import { logger } from '../utils/logger';
import { Like } from 'typeorm';

export class SettingsController {
  // 获取设置列表
  async getList(req: Request, res: Response): Promise<Response> {
    try {
      const { 
        page = 1, 
        pageSize = 20, 
        type, 
        group,
        keyword,
        isEnabled
      } = req.query;
      
      const queryBuilder = AppDataSource.getRepository(Settings)
        .createQueryBuilder('settings')
        .where('settings.isDeleted = :isDeleted', { isDeleted: 0 });

      // 添加查询条件
      if (type !== undefined) {
        queryBuilder.andWhere('settings.type = :type', { type });
      }
      
      if (group) {
        queryBuilder.andWhere('settings.group = :group', { group });
      }
      
      if (isEnabled !== undefined) {
        queryBuilder.andWhere('settings.isEnabled = :isEnabled', { isEnabled });
      }
      
      if (keyword) {
        queryBuilder.andWhere('(settings.name LIKE :keyword OR settings.key LIKE :keyword OR settings.description LIKE :keyword)', 
          { keyword: `%${keyword}%` });
      }
      
      // 分页查询
      const skip = (Number(page) - 1) * Number(pageSize);
      const [settings, total] = await queryBuilder
        .orderBy('settings.sort', 'ASC')
        .addOrderBy('settings.id', 'DESC')
        .skip(skip)
        .take(Number(pageSize))
        .getManyAndCount();

      // 获取所有设置分组
      const groups = await AppDataSource.getRepository(Settings)
        .createQueryBuilder('settings')
        .select('DISTINCT settings.group', 'group')
        .where('settings.isDeleted = 0')
        .andWhere('settings.group IS NOT NULL')
        .getRawMany();

      // 获取所有设置类型
      const types = Object.entries(SettingType)
        .filter(([key]) => isNaN(Number(key)))
        .map(([key, value]) => ({
          label: key,
          value: value
        }));

      return successResponse(res, {
        settings,
        total,
        groups: groups.map(g => g.group),
        types
      }, '获取设置列表成功');
    } catch (error) {
      logger.error('获取设置列表失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  async getSiteList(req: Request, res: Response): Promise<Response> {
    try {
      const queryBuilder = AppDataSource.getRepository(Settings)
       .createQueryBuilder('settings')
       .where('settings.isDeleted = :isDeleted', { isDeleted: 0 })
       .andWhere('settings.type = :type', { type: SettingType.SITE });

      const [settings, total] = await queryBuilder.getManyAndCount();

      return successResponse(res, {
        settings,
        total
      })
    }
    catch (error) {
      logger.error('获取设置列表失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 获取设置详情
  async getDetail(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      
      const setting = await AppDataSource.getRepository(Settings).findOne({
        where: { id: Number(id), isDeleted: 0 }
      });

      if (!setting) {
        return errorResponse(res, 404, '设置不存在', null);
      }

      return successResponse(res, setting, '获取设置详情成功');
    } catch (error) {
      logger.error('获取设置详情失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 创建设置
  async create(req: Request, res: Response): Promise<Response> {
    try {
      const { 
        key, 
        value, 
        type,
        description, 
        group,
        isSystem,
        isEnabled,
        sort
      } = req.body;

      // 验证必填字段
      const name = SettingsController.getSettingNames(key);
      if (!key || name === null) {
        return errorResponse(res, 400, '缺少必要参数', null);
      }

      // 检查键名是否已存在
      const existingSetting = await AppDataSource.getRepository(Settings).findOne({
        where: { key, isDeleted: 0 }
      });

      if (existingSetting) {
        return errorResponse(res, 400, '设置键名已存在', null);
      }

      // 创建设置
      const setting = new Settings();
      setting.key = key;
      setting.value = value || '';
      setting.type = type || SettingType.SYSTEM;
      setting.name = name;
      setting.description = description || null;
      setting.group = group || null;
      setting.isSystem = isSystem || 0;
      setting.isEnabled = isEnabled === undefined ? 1 : isEnabled;
      setting.sort = sort || 0;

      // 保存设置
      const savedSetting = await AppDataSource.getRepository(Settings).save(setting);

      return successResponse(res, savedSetting, '创建设置成功');
    } catch (error) {
      logger.error('创建设置失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 更新设置
  async update(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { 
        value, 
        type, 
        name, 
        description, 
        group,
        isEnabled,
        sort
      } = req.body;

      // 查找设置
      const setting = await AppDataSource.getRepository(Settings).findOne({
        where: { id: Number(id), isDeleted: 0 }
      });

      if (!setting) {
        return errorResponse(res, 404, '设置不存在', null);
      }

      // 系统内置设置只允许修改value和isEnabled
      if (setting.isSystem === 1) {
        setting.value = value !== undefined ? value : setting.value;
        setting.isEnabled = isEnabled !== undefined ? isEnabled : setting.isEnabled;
      } else {
        // 非系统设置可以修改所有字段
        setting.value = value !== undefined ? value : setting.value;
        setting.type = type !== undefined ? type : setting.type;
        setting.name = name || setting.name;
        setting.description = description !== undefined ? description : setting.description;
        setting.group = group !== undefined ? group : setting.group;
        setting.isEnabled = isEnabled !== undefined ? isEnabled : setting.isEnabled;
        setting.sort = sort !== undefined ? sort : setting.sort;
      }

      // 保存更新
      const updatedSetting = await AppDataSource.getRepository(Settings).save(setting);

      return successResponse(res, updatedSetting, '更新设置成功');
    } catch (error) {
      logger.error('更新设置失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 批量更新设置
  async batchUpdate(req: Request, res: Response): Promise<Response> {
    try {
      const { settings } = req.body;
      if (!Array.isArray(settings) || settings.length === 0) {
        return errorResponse(res, 400, '缺少必要参数', null);
      }

      // 批量更新设置
      const updatedSettings = await Promise.all(settings.map(async (settingData: any) => {
        const { key, value, isEnabled } = settingData;

        const name = SettingsController.getSettingNames(key);
        if (!key || name === null) {
          return null;
        }
        // 查找设置
        const setting = await AppDataSource.getRepository(Settings).findOne({
          where: { key, isDeleted: 0 }
        });

        if (!setting) {
            // 创建新的
            const newSetting = new Settings();
            newSetting.type = SettingsController.getSettingType(key);
            newSetting.name = name;
            newSetting.key = key;
            newSetting.value = value || '';
            newSetting.isEnabled = isEnabled === undefined ? 1 : isEnabled;
            return await AppDataSource.getRepository(Settings).save(newSetting);
        } else {
            setting.value = value !== undefined ? value : setting.value;
            return await AppDataSource.getRepository(Settings).save(setting);
        }
      }))
      // 过滤掉未找到的设置
      const validSettings = updatedSettings.filter(setting => setting !== null);
      return successResponse(res, validSettings, '批量更新设置成功');   

    } catch (error) {
      logger.error('批量更新设置失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 删除设置
  async delete(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      
      // 查找设置
      const setting = await AppDataSource.getRepository(Settings).findOne({
        where: { id: Number(id), isDeleted: 0 }
      });

      if (!setting) {
        return errorResponse(res, 404, '设置不存在', null);
      }

      // 系统内置设置不允许删除
      if (setting.isSystem === 1) {
        return errorResponse(res, 403, '系统内置设置不允许删除', null);
      }

      // 软删除
      setting.isDeleted = 1;
      await AppDataSource.getRepository(Settings).save(setting);

      return successResponse(res, null, '删除设置成功');
    } catch (error) {
      logger.error('删除设置失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  // 批量获取设置（根据分组或类型）
  async getBatch(req: Request, res: Response): Promise<Response> {
    try {
      const { group, type } = req.query;
      
      const queryBuilder = AppDataSource.getRepository(Settings)
        .createQueryBuilder('settings')
        .where('settings.isDeleted = :isDeleted', { isDeleted: 0 })
        .andWhere('settings.isEnabled = :isEnabled', { isEnabled: 1 });

      if (group) {
        queryBuilder.andWhere('settings.group = :group', { group });
      }

      if (type !== undefined) {
        queryBuilder.andWhere('settings.type = :type', { type });
      }

      const settings = await queryBuilder
        .orderBy('settings.sort', 'ASC')
        .getMany();

      // 将设置转换为键值对格式
      const settingsMap: Record<string, any> = {};
      settings.forEach(setting => {
        try {
          settingsMap[setting.key] = JSON.parse(setting.value);
        } catch (e) {
          // 如果不是有效的JSON，则直接使用原始值
          settingsMap[setting.key] = setting.value;
        }
      });

      return successResponse(res, settingsMap, '获取设置成功');
    } catch (error) {
      logger.error('批量获取设置失败:', error);
      return errorResponse(res, 500, '服务器内部错误', null);
    }
  }

  static getSettingNames(id: string): string | null {
    const settingNames = {
      site_title: '站点标题',
      site_description: '站点描述',
      site_keywords: '站点关键词',
      site_logo: '站点Logo',
      site_icp: 'ICP备案号',
      enable_visit: '开启站点',
      enable_invite: '开启邀请注册',
      enable_register: '开启注册',
      site_analytics: '站点统计代码',
      bonus_series_ids: '赠品系列',
    }
    if (Object.prototype.hasOwnProperty.call(settingNames, id)) {
      return settingNames[id as keyof typeof settingNames]
    } else return null
  }

  static getSettingType(key: string): SettingType {
    const profix = key.substring(0, key.indexOf('_'));
    if (profix === 'site') return SettingType.SITE;
    else return SettingType.SYSTEM
  }
}