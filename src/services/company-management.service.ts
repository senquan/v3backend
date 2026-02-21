import { Repository, Like } from 'typeorm';
import { CompanyInfo } from '../models/company-info.entity';
import { RedisCacheService } from './cache.service';

export class CompanyService {
  private readonly CACHE_TTL = 3600;
  private readonly CACHE_PREFIX = 'company';

  constructor(
    private companyRepository: Repository<CompanyInfo>,
    private cacheService: RedisCacheService,
  ) {}

  private getCacheKey(type: string, ...args: any[]): string {
    return `${this.CACHE_PREFIX}:${type}:${args.join(':')}`;
  }

  async findAll(query: any) {
    const { page = 1, size = 10, keyword, status, parentCompanyId } = query;
    const pageNum = parseInt(page as string);
    const pageSize = parseInt(size as string);
    const skip = (pageNum - 1) * pageSize;

    const queryBuilder = this.companyRepository.createQueryBuilder('company')
      .leftJoinAndSelect('company.parentCompany', 'parentCompany')
      .leftJoin('company.creator', 'creator')
      .addSelect('creator.name')
      .leftJoin('company.updater', 'updater')
      .addSelect('updater.name')
      .where('company.isDeleted = 0')

    if (keyword) {
      queryBuilder.andWhere('(company.companyCode LIKE :keyword OR company.companyName LIKE :keyword)', { keyword: `%${keyword}%` });
    }
    if (status !== undefined && status !== '') {
      queryBuilder.andWhere('company.status = :status', { status: parseInt(status as string) });
    }
    if (parentCompanyId !== undefined && parentCompanyId !== '') {
      queryBuilder.andWhere('company.parentCompanyId = :parentCompanyId', { parentCompanyId: parseInt(parentCompanyId as string) });
    }

    queryBuilder.orderBy('company.createdAt', 'DESC')
      .skip(skip)
      .take(pageSize);

    const [records, total] = await queryBuilder.getManyAndCount();

    return {
      records,
      total,
      page: pageNum,
      size: pageSize
    };
  }

  async findOne(id: number) {
    const cacheKey = this.getCacheKey('id', id);
    const cached = await this.cacheService.get<CompanyInfo>(cacheKey);
    if (cached) {
      return cached;
    }

    const result = await this.companyRepository.findOne({ 
      where: { id, isDeleted: 0 },
      relations: ['parentCompany', 'children']
    });
    if (result) {
      await this.cacheService.set(cacheKey, result, this.CACHE_TTL);
    }
    return result;
  }

  async findByCode(companyCode: string) {
    return await this.companyRepository.findOne({ where: { companyCode } });
  }

  async findByParentId(parentCompanyId: number | null) {
    const where: any = parentCompanyId === null || parentCompanyId === undefined 
      ? { parentCompanyId: null }
      : { parentCompanyId };
    
    return await this.companyRepository.find({
      where,
      order: { companyCode: 'ASC' }
    });
  }

  async getTree() {
    const cacheKey = this.getCacheKey('tree');
    const cached = await this.cacheService.get<CompanyInfo[]>(cacheKey);
    if (cached) {
      return this.buildTree(cached);
    }

    const allCompanies = await this.companyRepository.find({
      where: { isDeleted: 0 },
      relations: ['parentCompany']
    });
    
    await this.cacheService.set(cacheKey, allCompanies, this.CACHE_TTL);
    return this.buildTree(allCompanies);
  }

  private buildTree(companies: CompanyInfo[]): any[] {
    const companyMap = new Map<number, any>();
    const roots: any[] = [];

    companies.forEach(company => {
      companyMap.set(company.id, {
        value: company.id,
        label: company.companyName,
        code: company.companyCode,
        children: []
      });
    });

    companies.forEach(company => {
      const node = companyMap.get(company.id);
      if (company.parentCompanyId === null) {
        roots.push(node);
      } else {
        const parent = companyMap.get(company.parentCompanyId);
        if (parent) {
          parent.children.push(node);
        }
      }
    });

    return roots;
  }

  async create(data: Partial<CompanyInfo>, userId: number) {
    const existing = await this.findByCode(data.companyCode || '');
    if (existing) {
      throw new Error('单位编号已存在');
    }

    let companyLevel = 1;
    if (data.parentCompanyId) {
      const parent = await this.findOne(data.parentCompanyId);
      if (parent) {
        companyLevel = parent.companyLevel + 1;
      }
    }

    const company = this.companyRepository.create({
      ...data,
      companyLevel,
      status: data.status || 1,
      createdBy: userId,
      updatedBy: userId
    });

    const result = await this.companyRepository.save(company);
    await this.clearCache();
    return result;
  }

  async update(id: number, data: Partial<CompanyInfo>, userId: number) {
    const company = await this.findOne(id);
    if (!company) {
      throw new Error('单位不存在');
    }

    if (data.parentCompanyId !== undefined && data.parentCompanyId !== company.parentCompanyId) {
      if (data.parentCompanyId === id) {
        throw new Error('不能设置自己为上级单位');
      }
      
      const children = await this.findByParentId(id);
      if (data.parentCompanyId) {
        const isDescendant = await this.isDescendant(children, data.parentCompanyId);
        if (isDescendant) {
          throw new Error('不能设置自己的下级单位为上级单位');
        }
      }

      if (data.parentCompanyId) {
        const parent = await this.findOne(data.parentCompanyId);
        if (parent) {
          data.companyLevel = parent.companyLevel + 1;
        }
      } else {
        data.companyLevel = 1;
      }
    }

    await this.companyRepository.update(id, {
      ...data,
      updatedBy: userId
    });

    await this.clearCache();
    return await this.findOne(id);
  }

  private async isDescendant(children: CompanyInfo[], parentId: number): Promise<boolean> {
    for (const child of children) {
      if (child.id === parentId) {
        return true;
      }
      const grandChildren = await this.findByParentId(child.id);
      if (grandChildren.length > 0) {
        if (await this.isDescendant(grandChildren, parentId)) {
          return true;
        }
      }
    }
    return false;
  }

  async remove(id: number) {
    const children = await this.findByParentId(id);
    if (children.length > 0) {
      throw new Error('该单位存在下级单位，无法删除');
    }

    await this.clearCache();
    return await this.companyRepository.delete(id);
  }

  async updateStatus(id: number, status: number, userId: number) {
    await this.companyRepository.update(id, {
      status,
      updatedBy: userId
    });
    await this.clearCache();
    return await this.findOne(id);
  }

  async clearCache() {
    const pattern = `${this.CACHE_PREFIX}:*`;
    const keys = await this.cacheService['client'].keys(pattern);
    if (keys && keys.length > 0) {
      await this.cacheService['client'].del(...keys);
    }
  }
}
