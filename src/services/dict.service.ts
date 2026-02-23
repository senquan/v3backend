import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Dict } from '../models/dict.entity';
import { RedisCacheService } from './cache.service';

@Injectable()
export class DictService {
  private readonly CACHE_TTL = 3600;
  private readonly CACHE_PREFIX = 'dict';

  constructor(
    @InjectRepository(Dict)
    private dictRepository: Repository<Dict>,
    private cacheService: RedisCacheService,
  ) {}

  private getCacheKey(type: string, ...args: any[]): string {
    return `${this.CACHE_PREFIX}:${type}:${args.join(':')}`;
  }

  async findAll(query: any) {
    const { page = 1, size = 10, group, name, value } = query;
    const pageNum = parseInt(page as string);
    const pageSize = parseInt(size as string);
    const skip = (pageNum - 1) * pageSize;

    const where: any = {};
    if (group !== undefined && group !== null && group !== '') {
      where.group = parseInt(group as string);
    }
    if (name) {
      where.name = Like(`%${name}%`);
    }
    if (value) {
      where.value = Like(`%${value}%`);
    }

    const [records, total] = await this.dictRepository.findAndCount({
      where,
      skip,
      take: pageSize,
      order: { group: 'ASC', id: 'ASC' }
    });

    return {
      records,
      total,
      page: pageNum,
      size: pageSize
    };
  }

  async findOne(id: number) {
    const cacheKey = this.getCacheKey('id', id);
    const cached = await this.cacheService.get<Dict>(cacheKey);
    if (cached) {
      return cached;
    }

    const result = await this.dictRepository.findOne({ where: { id } });
    if (result) {
      await this.cacheService.set(cacheKey, result, this.CACHE_TTL);
    }
    return result;
  }

  async findByGroup(group: number) {
    const cacheKey = this.getCacheKey('group', group);
    const cached = await this.cacheService.get<Dict[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const result = await this.dictRepository.find({
      where: { group },
      order: { id: 'ASC' }
    });
    await this.cacheService.set(cacheKey, result, this.CACHE_TTL);
    return result;
  }

  async findByGroupAndValue(group: number, value: string) {
    const cacheKey = this.getCacheKey('group:value', group, value);
    const cached = await this.cacheService.get<Dict>(cacheKey);
    if (cached) {
      return cached;
    }

    const result = await this.dictRepository.findOne({
      where: { group, value }
    });
    if (result) {
      await this.cacheService.set(cacheKey, result, this.CACHE_TTL);
    }
    return result;
  }

  async getNameByValue(group: number, value: string): Promise<string | null> {
    const dict = await this.findByGroupAndValue(group, value);
    return dict?.name || null;
  }

  async getNameByValueFromCache(group: number, value: string): Promise<string | null> {
    const cacheKey = this.getCacheKey('name', group, value);
    const cached = await this.cacheService.get<string>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    const name = await this.getNameByValue(group, value);
    if (name) {
      await this.cacheService.set(cacheKey, name, this.CACHE_TTL);
    }
    return name;
  }

  async getAllGroups() {
    const cacheKey = this.getCacheKey('groups');
    const cached = await this.cacheService.get<number[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const result = await this.dictRepository
      .createQueryBuilder('dict')
      .select('DISTINCT dict.group', 'group')
      .getRawMany();
    
    const groups = result.map(item => parseInt(item.group));
    await this.cacheService.set(cacheKey, groups, this.CACHE_TTL);
    return groups;
  }

  async create(data: Partial<Dict>) {
    const dict = this.dictRepository.create(data);
    const result = await this.dictRepository.save(dict);
    await this.clearCache();
    return result;
  }

  async update(id: number, data: Partial<Dict>) {
    await this.dictRepository.update(id, data);
    await this.clearCache();
    return await this.findOne(id);
  }

  async remove(id: number) {
    await this.clearCache();
    return await this.dictRepository.delete(id);
  }

  async clearCache() {
    const pattern = `${this.CACHE_PREFIX}:*`;
    const keys = await this.cacheService['client'].keys(pattern);
    if (keys && keys.length > 0) {
      await this.cacheService['client'].del(...keys);
    }
  }

  async getDictMap(group: number): Promise<Map<string, string>> {
    const cacheKey = this.getCacheKey('map', group);
    const cached = await this.cacheService.get<Record<string, string>>(cacheKey);
    if (cached) {
      return new Map(Object.entries(cached));
    }

    const items = await this.findByGroup(group);
    const map: Record<string, string> = {};
    items.forEach(item => {
      map[item.value] = item.name;
    });
    
    await this.cacheService.set(cacheKey, map, this.CACHE_TTL);
    return new Map(Object.entries(map));
  }
}
