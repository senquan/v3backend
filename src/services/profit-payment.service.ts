import { Repository, In } from 'typeorm';
import { ProfitPayment } from '../models/profit-payment.entity';
import { CompanyInfo } from '../models/company-info.entity';
import { RedisCacheService } from './cache.service';

export interface ProfitPaymentImportData {
  companyId?: number;
  companyName?: string;
  dueProfit1?: number | string;
  dueProfit2?: number | string;
  actualAmount?: number | string;
  lastPaymentDate?: Date | string | null;
  businessYear: number;
}

export class ProfitPaymentService {
  private readonly CACHE_TTL = 3600;
  private readonly CACHE_PREFIX = 'profit_payment';

  constructor(
    private profitPaymentRepository: Repository<ProfitPayment>,
    private companyRepository: Repository<CompanyInfo>,
    private cacheService: RedisCacheService,
  ) {}

  private getCacheKey(type: string, ...args: any[]): string {
    return `${this.CACHE_PREFIX}:${type}:${args.join(':')}`;
  }

  async findAll(query: any) {
    const { page = 1, size = 10, companyId, businessYear, status, keyword } = query;
    const pageNum = parseInt(page as string);
    const pageSize = parseInt(size as string);
    const skip = (pageNum - 1) * pageSize;

    const queryBuilder = this.profitPaymentRepository.createQueryBuilder('payment')
      .leftJoinAndSelect('payment.company', 'company')
      .leftJoinAndSelect('payment.creator', 'creator')
      .leftJoinAndSelect('payment.updater', 'updater');

    if (companyId) {
      queryBuilder.andWhere('payment.companyId = :companyId', { companyId: parseInt(companyId as string) });
    }
    if (businessYear) {
      queryBuilder.andWhere('payment.businessYear = :businessYear', { businessYear: parseInt(businessYear as string) });
    }
    if (status) {
      queryBuilder.andWhere('payment.status = :status', { status: parseInt(status as string) });
    } else {
      queryBuilder.andWhere('payment.status != 3');
    }
    if (keyword) {
      queryBuilder.andWhere('(company.companyName LIKE :keyword OR company.companyCode LIKE :keyword)', { keyword: `%${keyword}%` });
    }

    const [records, total] = await queryBuilder
      .select([
        'payment',
        'company.id',
        'company.companyCode',
        'creator.name',
        'updater.name',
        'company.companyName'
      ])
      .orderBy('payment.businessYear', 'DESC')
      .addOrderBy('payment.createdAt', 'DESC')
      .skip(skip)
      .take(pageSize)
      .getManyAndCount();

    return {
      records,
      total,
      page: pageNum,
      size: pageSize
    };
  }

  async findOne(id: number) {
    const cacheKey = this.getCacheKey('id', id);
    const cached = await this.cacheService.get<ProfitPayment>(cacheKey);
    if (cached) {
      return cached;
    }

    const result = await this.profitPaymentRepository.findOne({
      where: { id },
      relations: ['company']
    });
    if (result) {
      await this.cacheService.set(cacheKey, result, this.CACHE_TTL);
    }
    return result;
  }

  async findByCompanyAndYear(companyId: number, businessYear: number) {
    return await this.profitPaymentRepository.findOne({
      where: { companyId, businessYear }
    });
  }

  async findByBatchNo(batchNo: string) {
    return await this.profitPaymentRepository.find({
      where: { batchNo },
      order: { createdAt: 'DESC' }
    });
  }

  async create(data: Partial<ProfitPayment>, userId: number) {
    const existing = await this.findByCompanyAndYear(data.companyId!, data.businessYear!);
    if (existing) {
      throw new Error(`该单位 ${data.businessYear} 年的利润上缴记录已存在`);
    }

    const profitPayment = this.profitPaymentRepository.create({
      ...data,
      dueProfit1: data.dueProfit1 || 0,
      dueProfit2: data.dueProfit2 || 0,
      actualAmount: data.actualAmount || 0,
      status: data.status || 1,
      createdBy: userId,
      updatedBy: userId
    });

    const result = await this.profitPaymentRepository.save(profitPayment);
    await this.clearCache();
    return result;
  }

  async update(id: number, data: Partial<ProfitPayment>, userId: number) {
    const profitPayment = await this.findOne(id);
    if (!profitPayment) {
      throw new Error('利润上缴记录不存在');
    }

    if (profitPayment.status === 2) {
      throw new Error('已生效的记录不能修改');
    }

    await this.profitPaymentRepository.update(id, {
      ...data,
      updatedBy: userId
    });

    await this.clearCache();
    return await this.findOne(id);
  }

  async remove(id: number, userId: number) {
    const profitPayment = await this.findOne(id);
    if (!profitPayment) {
      throw new Error('利润上缴记录不存在');
    }

    if (profitPayment.status === 2) {
      throw new Error('已生效的记录不能删除');
    }

    await this.profitPaymentRepository.update(id, {
      status: 3,
      updatedBy: userId
    });

    await this.clearCache();
    return { id, status: 3 };
  }

  async confirm(id: number, userId: number) {
    const profitPayment = await this.findOne(id);
    if (!profitPayment) {
      throw new Error('利润上缴记录不存在');
    }

    if (profitPayment.status !== 1) {
      throw new Error('只有待确认状态的记录才能确认');
    }

    await this.profitPaymentRepository.update(id, {
      status: 2,
      updatedBy: userId
    });

    await this.clearCache();
    return await this.findOne(id);
  }

  async batchConfirm(ids: number[], userId: number) {
    const result = await this.profitPaymentRepository.update(
      { id: In(ids), status: 1 },
      { status: 2, updatedBy: userId }
    );

    await this.clearCache();
    return { affected: result.affected };
  }

  async batchImport(dataList: ProfitPaymentImportData[], batchNo: string, userId: number) {
    const importedRecords: ProfitPayment[] = [];
    const errors: string[] = [];

    const companies = await this.companyRepository.find({
      select: ['id', 'companyName', 'companyCode']
    });
    const companyNameToId: Map<string, number> = new Map();
    companies.forEach(company => {
      companyNameToId.set(company.companyName, company.id);
    });

    for (let i = 0; i < dataList.length; i++) {
      const item = dataList[i];

      if (!item.companyId && !item.companyName) {
        errors.push(`第${i + 1}行：单位名称不能为空`);
        continue;
      }

      let companyId = item.companyId;
      if (!companyId && item.companyName) {
        companyId = companyNameToId.get(item.companyName);
        if (!companyId) {
          errors.push(`第${i + 1}行：单位名称 "${item.companyName}" 不存在于系统中`);
          continue;
        }
      }

      if (!item.businessYear) {
        errors.push(`第${i + 1}行：业务年份不能为空`);
        continue;
      }

      const existing = await this.findByCompanyAndYear(companyId!, item.businessYear);
      if (existing) {
        errors.push(`第${i + 1}行：该单位 ${item.businessYear} 年的利润上缴记录已存在`);
        continue;
      }

      const profitPayment = this.profitPaymentRepository.create({
        companyId: companyId,
        dueProfit1: parseFloat(item.dueProfit1 as any) || 0,
        dueProfit2: parseFloat(item.dueProfit2 as any) || 0,
        actualAmount: parseFloat(item.actualAmount as any) || 0,
        lastPaymentDate: item.lastPaymentDate || null,
        businessYear: item.businessYear,
        status: 1,
        batchNo: batchNo,
        createdBy: userId,
        updatedBy: userId
      });

      try {
        const saved = await this.profitPaymentRepository.save(profitPayment);
        importedRecords.push(saved);
      } catch (saveError: any) {
        errors.push(`第${i + 1}行：保存失败 - ${saveError.message}`);
      }
    }

    await this.clearCache();

    return {
      success: errors.length === 0,
      total: dataList.length,
      successCount: importedRecords.length,
      errorCount: errors.length,
      batchNo,
      importedRecords,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  async getSummary(query: any) {
    const { businessYear, companyId } = query;

    const queryBuilder = this.profitPaymentRepository.createQueryBuilder('payment')
      .select('SUM(payment.dueProfit1)', 'totalDueProfit1')
      .addSelect('SUM(payment.dueProfit2)', 'totalDueProfit2')
      .addSelect('SUM(payment.actualAmount)', 'totalActualAmount')
      .addSelect('COUNT(payment.id)', 'recordCount')
      .where('payment.status != 3');

    if (businessYear) {
      queryBuilder.andWhere('payment.businessYear = :businessYear', { businessYear: parseInt(businessYear as string) });
    }
    if (companyId) {
      queryBuilder.andWhere('payment.companyId = :companyId', { companyId: parseInt(companyId as string) });
    }

    const result = await queryBuilder.getRawOne();

    return {
      totalDueProfit1: parseFloat(result.total_due_profit1) || 0,
      totalDueProfit2: parseFloat(result.total_due_profit2) || 0,
      totalActualAmount: parseFloat(result.total_actual_amount) || 0,
      recordCount: parseInt(result.record_count) || 0
    };
  }

  async clearCache() {
    const pattern = `${this.CACHE_PREFIX}:*`;
    const keys = await this.cacheService['client'].keys(pattern);
    if (keys && keys.length > 0) {
      await this.cacheService['client'].del(...keys);
    }
  }
}
