import { Response } from 'express';
import { In } from 'typeorm';
import { CompanyInfo } from '../models/company-info.entity';
import { Dict } from '../models/dict.entity';
import { FixedDeposit } from '../models/fixed-deposit.entity';
import { ProfitPayment } from '../models/profit-payment.entity';
import { AppDataSource } from '../config/database';
import { successResponse, errorResponse } from '../utils/response';
import { RedisCacheService } from '../services/cache.service';
import { ProfitPaymentService } from '../services/profit-payment.service';

export class FinanceController {
  private companyRepository = AppDataSource.getRepository(CompanyInfo);

  getCompanies(req: any, res: Response) {
    return successResponse(res, {
      items: [],
      total: 0,
      page: 1,
      size: 10
    }, '查询成功');
  }

  getDeposits(req: any, res: Response) {
    return successResponse(res, {
      items: [],
      total: 0,
      page: 1,
      size: 10
    }, '查询成功');
  }

  getExpenses(req: any, res: Response) {
    return successResponse(res, {
      items: [],
      total: 0,
      page: 1,
      size: 10
    }, '查询成功');
  }

  getPayments(req: any, res: Response) {
    return successResponse(res, {
      items: [],
      total: 0,
      page: 1,
      size: 10
    }, '查询成功');
  }

  private generateMockData(company: CompanyInfo, endDate: string) {
    const currentDepositInitial = Math.random() * 1000000 + 500000;
    const currentDepositReceived = Math.random() * 500000 + 200000;
    const currentDepositTransferUp = Math.random() * 300000 + 100000;
    const currentDepositTransferDown = Math.random() * 200000 + 50000;
    const currentDepositToFixed = Math.random() * 100000 + 20000;

    const currentDepositSubtotal = currentDepositInitial + currentDepositReceived 
      + currentDepositTransferUp - currentDepositTransferDown - currentDepositToFixed;

    const fixedDeposit3Months = Math.random() * 300000 + 100000;
    const fixedDeposit6Months = Math.random() * 200000 + 50000;
    const fixedDeposit12Months = Math.random() * 150000 + 30000;
    const fixedDepositSubtotal = fixedDeposit3Months + fixedDeposit6Months + fixedDeposit12Months;

    const depositTotal = currentDepositSubtotal + fixedDepositSubtotal;

    const interestCurrent = currentDepositSubtotal * 0.0015;
    const interestFixed = fixedDepositSubtotal * 0.025;
    const interestSubtotal = interestCurrent + interestFixed;

    const loanBalance = Math.random() * 1500000 + 500000;
    const loanInterest = loanBalance * 0.035;
    const loanSubtotal = loanBalance + loanInterest;

    const total = depositTotal + interestSubtotal - loanSubtotal;

    return {
      id: company.id,
      companyCode: company.companyCode || '',
      companyName: company.companyName || '',
      reportDate: endDate || new Date().toISOString().split('T')[0],
      loanBalance: Math.round(loanBalance * 100) / 100,
      loanInterest: Math.round(loanInterest * 100) / 100,
      loanSubtotal: Math.round(loanSubtotal * 100) / 100,
      currentDepositInitial: Math.round(currentDepositInitial * 100) / 100,
      currentDepositReceived: Math.round(currentDepositReceived * 100) / 100,
      currentDepositTransferUp: Math.round(currentDepositTransferUp * 100) / 100,
      currentDepositTransferDown: Math.round(currentDepositTransferDown * 100) / 100,
      currentDepositToFixed: Math.round(currentDepositToFixed * 100) / 100,
      currentDepositSubtotal: Math.round(currentDepositSubtotal * 100) / 100,
      fixedDeposit3Months: Math.round(fixedDeposit3Months * 100) / 100,
      fixedDeposit6Months: Math.round(fixedDeposit6Months * 100) / 100,
      fixedDeposit12Months: Math.round(fixedDeposit12Months * 100) / 100,
      fixedDepositSubtotal: Math.round(fixedDepositSubtotal * 100) / 100,
      depositTotal: Math.round(depositTotal * 100) / 100,
      interestCurrent: Math.round(interestCurrent * 100) / 100,
      interestFixed: Math.round(interestFixed * 100) / 100,
      interestSubtotal: Math.round(interestSubtotal * 100) / 100,
      total: Math.round(total * 100) / 100,
      status: 1,
      createdBy: 'system',
      createdAt: new Date().toISOString()
    };
  }

  async getLoanDepositSummary(req: any, res: Response) {
    try {
      const { companyName, companyCode, startDate, endDate, page = 1, size = 10 } = req.query;
      const pageNum = parseInt(page as string);
      const pageSize = parseInt(size as string);
      const skip = (pageNum - 1) * pageSize;

      let queryBuilder = this.companyRepository.createQueryBuilder('company');

      if (companyName) {
        queryBuilder = queryBuilder.andWhere('company.companyName LIKE :companyName', { companyName: `%${companyName}%` });
      }
      if (companyCode) {
        queryBuilder = queryBuilder.andWhere('company.companyCode LIKE :companyCode', { companyCode: `%${companyCode}%` });
      }

      const [companies, total] = await queryBuilder
        .skip(skip)
        .take(pageSize)
        .getManyAndCount();

      const items = companies.map(company => this.generateMockData(company, endDate as string));

      return successResponse(res, { items, total }, '查询成功');
    } catch (error) {
      return errorResponse(res, 500, `查询失败: ${error}`);
    }
  }

  async getLoanDepositSummaryById(req: any, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const company = await this.companyRepository.findOne({ where: { id } });
      
      if (!company) {
        return errorResponse(res, 404, '记录不存在');
      }

      const item = this.generateMockData(company, '');

      return successResponse(res, item, '查询成功');
    } catch (error) {
      return errorResponse(res, 500, `查询失败: ${error}`);
    }
  }
}

export class ImportDepositController {
  private fixedDepositRepository = AppDataSource.getRepository(FixedDeposit);
  private dictRepository = AppDataSource.getRepository(Dict);
  private companyRepository = AppDataSource.getRepository(CompanyInfo);

  async importDeposit(req: any, res: Response) {
    try {
      const { deposits, batchNo } = req.body;

      const userId = (req as any).user?.id;
      if (!userId) return errorResponse(res, 401, '未授权', null);

      if (!deposits || !Array.isArray(deposits) || deposits.length === 0) {
        return errorResponse(res, 400, '导入数据不能为空');
      }

      const currentBatchNo = batchNo || `IMP${Date.now()}`;
      const importedRecords: FixedDeposit[] = [];
      const errors: string[] = [];

      
      // 获取存款类型字典
      const depositTypeData = await this.dictRepository.find({ where: { group: 1 }, select: ['value', 'name'] });
      const depositTypeMap = depositTypeData.reduce((acc, cur) => {
        acc[cur.name] = Number(cur.value);
        return acc;
      }, {} as Record<string, number>);

      // 获取存款类型字典
      const depositPeriodData = await this.dictRepository.find({ where: { group: 3 }, select: ['value', 'name'] });
      const depositPeriodMap = depositPeriodData.reduce((acc, cur) => {
        acc[cur.name] = Number(cur.value);
        return acc;
      }, {} as Record<string, number>);

      const companies = await this.companyRepository.find({
        where: { status: 1 }
      });
      const companyNameToId: Map<string, number> = new Map();
      companies.forEach(company => {
        companyNameToId.set(company.companyName, company.id);
      });

      for (let i = 0; i < deposits.length; i++) {
        const item = deposits[i];

        if (!item.depositCode) {
          errors.push(`第${i + 1}行：存款编号不能为空`);
          continue;
        }

        if (!item.depositType || !depositTypeMap[item.depositType]) {
          errors.push(`第${i + 1}行：存款类型 ${item.depositType} 不存在`);
          continue;
        }

        if (!item.depositCode) {
          errors.push(`第${i + 1}行：存款编号不能为空`);
          continue;
        }

        if (!item.companyName) {
          errors.push(`第${i + 1}行：单位名称不能为空`);
          continue;
        }
        if (!companyNameToId.has(item.companyName)) {
          errors.push(`第${i + 1}行：单位名称 "${item.companyName}" 不存在于系统中`);
          continue;
        }
        if (!item.depositAmount || parseFloat(item.depositAmount) <= 0) {
          errors.push(`第${i + 1}行：金额必须大于0`);
          continue;
        }

        if (!item.startDate) {
          errors.push(`第${i + 1}行：起息日期不能为空`);
          continue;
        }

        if (!item.endDate) {
          errors.push(`第${i + 1}行：到期日不能为空`);
          continue;
        }

        if (!item.depositPeriod || !depositPeriodMap[item.depositPeriod]) {
          errors.push(`第${i + 1}行：存期类型 ${item.depositPeriod} 不存在`);
          continue;
        }

        const fixedDeposit = new FixedDeposit();
        fixedDeposit.depositCode = item.depositCode;
        fixedDeposit.depositType = depositTypeMap[item.depositType];
        fixedDeposit.startDate = new Date(item.startDate);
        fixedDeposit.companyId = companyNameToId.get(item.companyName) || 0;
        fixedDeposit.amount = parseFloat(item.depositAmount);
        fixedDeposit.depositPeriod = depositPeriodMap[item.depositPeriod];
        fixedDeposit.endDate = new Date(item.endDate);
        fixedDeposit.remark = item.remark || null;
        fixedDeposit.earlyRelease = 0;
        fixedDeposit.releaseDate = null;
        fixedDeposit.interestDays = 0;
        fixedDeposit.releaseAmount = 0;
        fixedDeposit.remainingAmount = parseFloat(item.depositAmount);
        fixedDeposit.status = 1;
        fixedDeposit.createdBy = userId;
        fixedDeposit.batchNo = currentBatchNo;
        fixedDeposit.lastInterestDate = new Date(item.startDate);

        try {
          const saved = await this.fixedDepositRepository.save(fixedDeposit);
          importedRecords.push(saved);
        } catch (saveError: any) {
          errors.push(`第${i + 1}行：保存失败 - ${saveError.message}`);
          continue;
        }
      }

      if (errors.length > 0 && importedRecords.length === 0) {
        return successResponse(res, {
          success: false,
          total: deposits.length,
          successCount: 0,
          errorCount: errors.length,
          errors
        }, '导入失败', 0);
      }

      return successResponse(res, {
        success: true,
        total: deposits.length,
        successCount: importedRecords.length,
        errorCount: errors.length,
        batchNo: currentBatchNo,
        importedRecords,
        errors: errors.length > 0 ? errors : undefined
      }, errors.length > 0 ? '部分数据导入成功' : '导入成功');
    } catch (error) {
      return errorResponse(res, 500, `导入失败: ${error}`);
    }
  }

  async getFixedDepositRecords(req: any, res: Response) {
    try {
      const { keyword, type, status, companyId, isReleased, startDate, endDate, page = 1, size = 10 } = req.query;
      const pageNum = parseInt(page as string);
      const pageSize = parseInt(size as string);
      const skip = (pageNum - 1) * pageSize;

      let queryBuilder = this.fixedDepositRepository.createQueryBuilder('deposit');
      
      if (type && type > 0) {
        queryBuilder = queryBuilder.andWhere('deposit.depositType = :type', { type: parseInt(type as string) });
      }
      if (keyword) {
        queryBuilder = queryBuilder.andWhere('(deposit.companyName LIKE :keyword OR deposit.batchNo LIKE :keyword)', { keyword: `%${keyword}%` });
      }
      if (status && status > 0) {
        queryBuilder = queryBuilder.andWhere('deposit.status = :status', { status: parseInt(status as string) });
      }
      if (startDate) {
        queryBuilder = queryBuilder.andWhere('deposit.startDate >= :startDate', { startDate: new Date(`${startDate} 00:00:00`) });
      }
      if (endDate) {
        queryBuilder = queryBuilder.andWhere('deposit.endDate <= :endDate', { endDate: new Date(`${endDate} 23:59:59`) });
      }
      if (companyId) {
        queryBuilder = queryBuilder.andWhere('deposit.companyId = :companyId', { companyId: parseInt(companyId as string) });
      }
      if (isReleased) {
        queryBuilder = queryBuilder.andWhere('deposit.earlyRelease = :isReleased', { isReleased: parseInt(isReleased as string) });
      }

      const [records, total] = await queryBuilder
        .leftJoinAndSelect('deposit.company', 'company')
        .innerJoinAndSelect('deposit.creator', 'creator')
        .select(['deposit', 'company', 'creator.name'])
        .orderBy('deposit.createdAt', 'DESC')
        .skip(skip)
        .take(pageSize)
        .getManyAndCount();

      return successResponse(res, { records, total }, '查询成功');
    } catch (error) {
      return errorResponse(res, 500, `查询失败: ${error}`);
    }
  }

  async confirmRecord(req: any, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const record = await this.fixedDepositRepository.findOne({ where: { id } });

      if (!record) {
        return errorResponse(res, 404, '记录不存在');
      }

      record.status = 2;
      const updated = await this.fixedDepositRepository.save(record);

      return successResponse(res, updated, '确认成功');
    } catch (error) {
      return errorResponse(res, 500, `确认失败: ${error}`);
    }
  }

  async batchConfirm(req: any, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return errorResponse(res, 401, '未授权');
      }

      const { ids } = req.body;
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return errorResponse(res, 400, '请选择要确认的记录');
      }

      const numIds = ids.map((id: string | number) => parseInt(id as string));
      const result = await this.fixedDepositRepository.update(
            { id: In(ids), status: 1 },
            { status: 2, updatedBy: userId }
          );

      return successResponse(res, result, `确认成功，共确认 ${result.affected} 条记录`);
    } catch (error) {
      return errorResponse(res, 500, `确认失败: ${error}`);
    }
  }

  async deleteRecord(req: any, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const record = await this.fixedDepositRepository.findOne({ where: { id } });

      if (!record) {
        return errorResponse(res, 404, '记录不存在');
      }

      await this.fixedDepositRepository.remove(record);

      return successResponse(res, null, '删除成功');
    } catch (error) {
      return errorResponse(res, 500, `删除失败: ${error}`);
    }
  }
}

export class ProfitPaymentController {
  private profitPaymentRepository = AppDataSource.getRepository(ProfitPayment);
  private companyRepository = AppDataSource.getRepository(CompanyInfo);
  private cacheService = new RedisCacheService();
  private profitPaymentService = new ProfitPaymentService(
    this.profitPaymentRepository,
    this.companyRepository,
    this.cacheService
  );

  async getList(req: any, res: Response) {
    try {
      const result = await this.profitPaymentService.findAll(req.query);
      return successResponse(res, result, '查询成功');
    } catch (error: any) {
      return errorResponse(res, 500, `查询失败: ${error.message}`);
    }
  }

  async getById(req: any, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return errorResponse(res, 400, '无效的记录ID');
      }

      const record = await this.profitPaymentService.findOne(id);
      if (!record) {
        return errorResponse(res, 404, '记录不存在');
      }

      return successResponse(res, record, '查询成功');
    } catch (error: any) {
      return errorResponse(res, 500, `查询失败: ${error.message}`);
    }
  }

  async create(req: any, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return errorResponse(res, 401, '未授权');
      }

      const { companyId, companyName, dueProfit1, dueProfit2, actualAmount, lastPaymentDate, businessYear } = req.body;

      if (!companyName && !companyId) {
        return errorResponse(res, 400, '单位名称不能为空');
      }
      if (!businessYear) {
        return errorResponse(res, 400, '业务年份不能为空');
      }

      let companyIdValue = companyId;
      if (!companyIdValue && companyName) {
        const company = await this.companyRepository.findOne({ where: { companyName } });
        if (!company) {
          return errorResponse(res, 400, '单位不存在');
        }
        companyIdValue = company.id;
      }

      const record = await this.profitPaymentService.create({
        companyId: companyIdValue,
        dueProfit1: dueProfit1 ? parseFloat(dueProfit1) : 0,
        dueProfit2: dueProfit2 ? parseFloat(dueProfit2) : 0,
        actualAmount: actualAmount ? parseFloat(actualAmount) : 0,
        lastPaymentDate: lastPaymentDate ? new Date(lastPaymentDate) : null,
        businessYear: parseInt(businessYear)
      }, userId);

      return successResponse(res, record, '创建成功');
    } catch (error: any) {
      return errorResponse(res, 400, error.message || '创建失败');
    }
  }

  async update(req: any, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return errorResponse(res, 401, '未授权');
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return errorResponse(res, 400, '无效的记录ID');
      }

      const { dueProfit1, dueProfit2, actualAmount, lastPaymentDate, status } = req.body;

      const record = await this.profitPaymentService.update(id, {
        dueProfit1: dueProfit1 ? parseFloat(dueProfit1) : undefined,
        dueProfit2: dueProfit2 ? parseFloat(dueProfit2) : undefined,
        actualAmount: actualAmount ? parseFloat(actualAmount) : undefined,
        lastPaymentDate: lastPaymentDate ? new Date(lastPaymentDate) : undefined,
        status: status ? parseInt(status) : undefined
      }, userId);

      return successResponse(res, record, '更新成功');
    } catch (error: any) {
      return errorResponse(res, 400, error.message || '更新失败');
    }
  }

  async delete(req: any, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return errorResponse(res, 401, '未授权');
      }

      const { id } = req.body;
      if (!id) {
        return errorResponse(res, 400, '记录ID不能为空');
      }

      await this.profitPaymentService.remove(parseInt(id), userId);
      return successResponse(res, null, '删除成功');
    } catch (error: any) {
      return errorResponse(res, 400, error.message || '删除失败');
    }
  }

  async confirm(req: any, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return errorResponse(res, 401, '未授权');
      }

      const { ids } = req.body;
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return errorResponse(res, 400, '请选择要确认的记录');
      }

      const numIds = ids.map((id: string | number) => parseInt(id as string));
      const result = await this.profitPaymentService.batchConfirm(numIds, userId);

      return successResponse(res, result, `确认成功，共确认 ${result.affected} 条记录`);
    } catch (error: any) {
      return errorResponse(res, 400, error.message || '确认失败');
    }
  }

  async importProfit(req: any, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return errorResponse(res, 401, '未授权');
      }

      const { profits, batchNo, businessYear } = req.body;

      if (!profits || !Array.isArray(profits) || profits.length === 0) {
        return errorResponse(res, 400, '导入数据不能为空');
      }

      const currentBatchNo = batchNo || `PP${Date.now()}`;
      const year = businessYear || new Date().getFullYear();

      const dataList = profits.map((item: any) => ({
        companyId: item.companyId,
        companyName: item.companyName,
        dueProfit1: item.dueProfit1,
        dueProfit2: item.dueProfit2,
        actualAmount: item.actualAmount,
        lastPaymentDate: item.lastPaymentDate,
        businessYear: item.businessYear || year
      }));

      const result = await this.profitPaymentService.batchImport(dataList, currentBatchNo, userId);

      if (!result.success && result.successCount === 0) {
        return successResponse(res, {
          success: false,
          total: result.total,
          successCount: 0,
          errorCount: result.errorCount,
          errors: result.errors
        }, '导入失败', 0);
      }

      return successResponse(res, {
        success: true,
        total: result.total,
        successCount: result.successCount,
        errorCount: result.errorCount,
        batchNo: result.batchNo,
        errors: result.errors
      }, result.errors ? '部分数据导入成功' : '导入成功');
    } catch (error: any) {
      return errorResponse(res, 500, `导入失败: ${error.message}`);
    }
  }

  async getSummary(req: any, res: Response) {
    try {
      const result = await this.profitPaymentService.getSummary(req.query);
      return successResponse(res, result, '查询成功');
    } catch (error: any) {
      return errorResponse(res, 500, `查询失败: ${error.message}`);
    }
  }

  async getByBatchNo(req: any, res: Response) {
    try {
      const { batchNo } = req.params;
      if (!batchNo) {
        return errorResponse(res, 400, '批次号不能为空');
      }

      const records = await this.profitPaymentService.findByBatchNo(batchNo);
      return successResponse(res, records, '查询成功');
    } catch (error: any) {
      return errorResponse(res, 500, `查询失败: ${error.message}`);
    }
  }
}
