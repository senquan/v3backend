import { Response } from 'express';
import { CompanyInfo } from '../models/company-info.entity';
import { FixedDeposit } from '../models/fixed-deposit.entity';
import { AppDataSource } from '../config/database';
import { successResponse, errorResponse } from '../utils/response';

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

      for (let i = 0; i < deposits.length; i++) {
        const item = deposits[i];

        if (!item.depositCode) {
          errors.push(`第${i + 1}行：存款编号不能为空`);
          continue;
        }

        if (!item.companyName) {
          errors.push(`第${i + 1}行：单位名称不能为空`);
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

        const depositPeriod = parseInt(item.depositPeriod) || 3;

        const fixedDeposit = new FixedDeposit();
        fixedDeposit.depositCode = item.depositCode;
        fixedDeposit.depositType = parseInt(item.depositType) || 1;
        fixedDeposit.startDate = new Date(item.startDate);
        fixedDeposit.companyName = item.companyName;
        fixedDeposit.amount = parseFloat(item.depositAmount);
        fixedDeposit.depositPeriod = depositPeriod;
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

  async getImportDepositRecords(req: any, res: Response) {
    try {
      const { batchNo, companyName, status, page = 1, size = 10 } = req.query;
      const pageNum = parseInt(page as string);
      const pageSize = parseInt(size as string);
      const skip = (pageNum - 1) * pageSize;

      let queryBuilder = this.fixedDepositRepository.createQueryBuilder('deposit');

      if (batchNo) {
        queryBuilder = queryBuilder.andWhere('deposit.batchNo = :batchNo', { batchNo });
      }
      if (companyName) {
        queryBuilder = queryBuilder.andWhere('deposit.companyName LIKE :companyName', { companyName: `%${companyName}%` });
      }
      if (status) {
        queryBuilder = queryBuilder.andWhere('deposit.status = :status', { status: parseInt(status as string) });
      }

      const [items, total] = await queryBuilder
        .orderBy('deposit.createdAt', 'DESC')
        .skip(skip)
        .take(pageSize)
        .getManyAndCount();

      return successResponse(res, { items, total }, '查询成功');
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
      const { batchNo } = req.body;

      if (!batchNo) {
        return errorResponse(res, 400, '批次号不能为空');
      }

      const result = await this.fixedDepositRepository.update(
        { batchNo, status: 1 },
        { status: 2 }
      );

      return successResponse(res, { affected: result.affected }, `批量确认成功，共确认 ${result.affected} 条记录`);
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
