import { Response } from 'express';
import { SettingsService } from '../services/settings.service';
import { CreateSettingsDto, UpdateSettingsDto, SettingsQueryDto } from '../dtos/settings.dto';
import { successResponse, errorResponse } from '../utils/response';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

export class SettingsController {
  private settingsService: SettingsService;

  constructor() {
    this.settingsService = new SettingsService();
  }

  async getSettingsList(req: any, res: Response) {
    try {
      const result = await this.settingsService.findAll(req.query);
      return successResponse(res, result, '查询成功');
    } catch (error: any) {
      return errorResponse(res, 500, `查询失败: ${error.message}`);
    }
  }

  async getSettingDetail(req: any, res: Response) {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return errorResponse(res, 400, '无效的配置ID');
      }

      const setting = await this.settingsService.findOne(id);
      
      if (!setting) {
        return errorResponse(res, 404, '配置项不存在');
      }

      return successResponse(res, setting, '查询成功');
    } catch (error: any) {
      return errorResponse(res, 500, `查询失败: ${error.message}`);
    }
  }

  async createSetting(req: any, res: Response) {
    try {
      const createDto = plainToInstance(CreateSettingsDto, req.body);

      // 设置创建人和更新人
      const userId = (req as any).user?.id || 1;
      createDto.createdBy = userId;
      createDto.updatedBy = userId;

      // 验证创建参数
      const errors = await validate(createDto);
      if (errors.length > 0) {
        return errorResponse(res, 400, '参数验证失败', errors);
      }

      const setting = await this.settingsService.create(createDto);
      return successResponse(res, setting, '创建成功');
    } catch (error: any) {
      return errorResponse(res, 500, `创建失败: ${error.message}`);
    }
  }

  async updateSetting(req: any, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const updateDto = plainToInstance(UpdateSettingsDto, req.body);
      
      if (isNaN(id)) {
        return errorResponse(res, 400, '无效的配置ID');
      }

      const existingSetting = await this.settingsService.findOne(id);
      if (!existingSetting) {
        return errorResponse(res, 404, '配置项不存在');
      }

      // 设置更新人
      updateDto.updatedBy = (req as any).user?.id || 1;

      // 验证更新参数
      const errors = await validate(updateDto);
      if (errors.length > 0) {
        return errorResponse(res, 400, '参数验证失败', errors);
      }

      const setting = await this.settingsService.update(id, updateDto);
      return successResponse(res, setting, '更新成功');
    } catch (error: any) {
      return errorResponse(res, 500, `更新失败: ${error.message}`);
    }
  }

  async deleteSetting(req: any, res: Response) {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return errorResponse(res, 400, '无效的配置ID');
      }

      const existingSetting = await this.settingsService.findOne(id);
      if (!existingSetting) {
        return errorResponse(res, 404, '配置项不存在');
      }

      await this.settingsService.remove(id);
      return successResponse(res, null, '删除成功');
    } catch (error: any) {
      return errorResponse(res, 500, `删除失败: ${error.message}`);
    }
  }

  async getSettingValue(req: any, res: Response) {
    try {
      const key = req.params.key;
      
      if (!key) {
        return errorResponse(res, 400, '配置键不能为空');
      }

      const value = await this.settingsService.getSettingByKey(key);
      
      if (value === null) {
        return errorResponse(res, 404, '配置项不存在');
      }

      return successResponse(res, { value }, '获取成功');
    } catch (error: any) {
      return errorResponse(res, 500, `获取失败: ${error.message}`);
    }
  }

  async updateSettingValue(req: any, res: Response) {
    try {
      const key = req.params.key;
      const { value } = req.body;
      
      if (!key) {
        return errorResponse(res, 400, '配置键不能为空');
      }

      if (value === undefined) {
        return errorResponse(res, 400, '配置值不能为空');
      }

      const userId = (req as any).user?.id || 1;
      const setting = await this.settingsService.updateSettingByKey(key, value, userId);
      
      return successResponse(res, setting, '更新成功');
    } catch (error: any) {
      return errorResponse(res, 500, `更新失败: ${error.message}`);
    }
  }

  async getGroupedSettings(req: any, res: Response) {
    try {
      const group = req.params.group;
      
      if (!group) {
        return errorResponse(res, 400, '配置分组不能为空');
      }

      const settings = await this.settingsService.getGroupedSettings(group);
      
      return successResponse(res, settings, '获取成功');
    } catch (error: any) {
      return errorResponse(res, 500, `获取失败: ${error.message}`);
    }
  }

  async getSettingTypes(req: any, res: Response) {
    try {
      const settingTypes = [
        { value: 1, label: '系统设置' },
        { value: 2, label: '支付设置' },
        { value: 3, label: '邮件设置' },
        { value: 4, label: '短信设置' },
        { value: 5, label: '物流设置' },
        { value: 6, label: '站点设置' },
        { value: 99, label: '自定义设置' }
      ];
      
      return successResponse(res, settingTypes, '获取成功');
    } catch (error: any) {
      return errorResponse(res, 500, `获取失败: ${error.message}`);
    }
  }

  async getSystemConfigOptions(req: any, res: Response) {
    try {
      const options = [
        { value: 1, label: '系统' },
        { value: 2, label: '自定义' }
      ];
      
      return successResponse(res, options, '获取成功');
    } catch (error: any) {
      return errorResponse(res, 500, `获取失败: ${error.message}`);
    }
  }

  async getStatusOptions(req: any, res: Response) {
    try {
      const options = [
        { value: 1, label: '启用' },
        { value: 2, label: '禁用' }
      ];
      
      return successResponse(res, options, '获取成功');
    } catch (error: any) {
      return errorResponse(res, 500, `获取失败: ${error.message}`);
    }
  }
}