import { Repository, Like, Not } from 'typeorm';
import { Settings } from '../models/settings.entity';
import { AppDataSource } from '../config/database';
import { CreateSettingsDto, UpdateSettingsDto, SettingsQueryDto } from '../dtos/settings.dto';

export class SettingsService {
  private readonly settingsRepository: Repository<Settings>;
  
  constructor() {
    this.settingsRepository = AppDataSource.getRepository(Settings);
  }

  async findAll(query: SettingsQueryDto) {
    const { page = 1, size = 10, keyword, group, type, isEnabled, isSystem } = query;
    const skip = (page - 1) * size;
    
    let whereConditions: any = {
      isDeleted: 0  // 排除已删除的记录
    };
    
    if (keyword) {
      whereConditions.key = Like(`%${keyword}%`);
    }
    
    if (group) {
      whereConditions.group = Like(`%${group}%`);
    }

    if (type) {
      whereConditions.type = type;
    }
    
    if (isEnabled !== undefined) {
      whereConditions.isEnabled = isEnabled;
    }
    
    if (isSystem !== undefined) {
      whereConditions.isSystem = isSystem;
    }

    const [records, total] = await this.settingsRepository.findAndCount({
      where: whereConditions,
      skip,
      take: size,
      order: { sort: 'ASC', createdAt: 'DESC' },
      relations: []
    });

    return {
      records,
      total,
      page: parseInt(page as any),
      size: parseInt(size as any)
    };
  }

  async findOne(id: number) {
    return await this.settingsRepository.findOne({
      where: { id, isDeleted: 0 }
    });
  }

  async findByKey(key: string) {
    return await this.settingsRepository.findOne({
      where: { key, isDeleted: 0 }
    });
  }

  async create(createSettingsDto: CreateSettingsDto) {
    // 检查键是否已存在
    const existingSetting = await this.settingsRepository.findOne({
      where: { key: createSettingsDto.key, isDeleted: 0 }
    });
    
    if (existingSetting) {
      throw new Error('配置键已存在');
    }
    
    const setting = this.settingsRepository.create({
      ...createSettingsDto,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    return await this.settingsRepository.save(setting);
  }

  async update(id: number, updateSettingsDto: UpdateSettingsDto) {
    const setting = await this.settingsRepository.findOne({
      where: { id, isDeleted: 0 }
    });
    
    if (!setting) {
      throw new Error('配置项不存在');
    }
    
    // 如果是系统配置，检查是否允许修改
    if (setting.isSystem === 1) {
      // 系统配置只允许修改 isEnabled 状态 和 值
      const allowedUpdates = {
        value: updateSettingsDto.value,
        isEnabled: updateSettingsDto.isEnabled,
        updatedBy: updateSettingsDto.updatedBy,
        updatedAt: new Date()
      };
      
      Object.assign(setting, allowedUpdates);
    } else {
      Object.assign(setting, updateSettingsDto, {
        updatedAt: new Date()
      });
    }
    
    return await this.settingsRepository.save(setting);
  }

  async remove(id: number) {
    const setting = await this.settingsRepository.findOne({
      where: { id, isDeleted: 0 }
    });
    
    if (!setting) {
      throw new Error('配置项不存在');
    }
    
    // 系统配置不允许删除
    if (setting.isSystem === 1) {
      throw new Error('系统配置不允许删除');
    }
    
    // 软删除
    setting.isDeleted = 1;
    setting.updatedAt = new Date();
    
    return await this.settingsRepository.save(setting);
  }

  async getSettingByKey(key: string) {
    const setting = await this.findByKey(key);
    if (!setting) {
      return null;
    }
    
    // 返回配置值，如果是JSON格式则解析
    try {
      return JSON.parse(setting.value);
    } catch (e) {
      return setting.value;
    }
  }

  async updateSettingByKey(key: string, value: any, updatedBy: number) {
    const setting = await this.findByKey(key);
    if (!setting) {
      throw new Error('配置项不存在');
    }
    
    // 系统配置不允许修改值
    if (setting.isSystem === 1) {
      throw new Error('系统配置不允许修改值');
    }
    
    setting.value = typeof value === 'string' ? value : JSON.stringify(value);
    setting.updatedBy = updatedBy;
    setting.updatedAt = new Date();
    
    return await this.settingsRepository.save(setting);
  }

  async getGroupedSettings(group: string) {
    const settings = await this.settingsRepository.find({
      where: { 
        group,
        isDeleted: 0,
        isEnabled: 1
      },
      order: { sort: 'ASC' }
    });
    
    const groupedResult: Record<string, any> = {};
    settings.forEach(setting => {
      try {
        groupedResult[setting.key] = JSON.parse(setting.value);
      } catch (e) {
        groupedResult[setting.key] = setting.value;
      }
    });
    
    return groupedResult;
  }

  async batchUpdateSettings(settingsData: { key: string; value: any }[], updatedBy: number) {
    const results = [];
    for (const settingData of settingsData) {
      try {
        const result = await this.updateSettingByKey(settingData.key, settingData.value, updatedBy);
        results.push(result);
      } catch (error: any) {
        results.push({ error: error.message, key: settingData.key });
      }
    }
    return results;
  }
}
