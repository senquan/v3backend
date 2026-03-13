import { Response } from 'express';
import { CompanyInfo } from '../models/company-info.entity';
import { Dict } from '../models/dict.entity';
import { PaymentReceive } from '../models/payment-receive.entity';
import { DepositLoanSummary } from '../models/deposit-loan-summary.entity';
import { DictService } from '../services/dict.service';
import { AppDataSource } from '../config/database';
import { successResponse, errorResponse } from '../utils/response';
import { In, QueryRunner } from 'typeorm';
import { RedisCacheService } from '../services/cache.service';
import { summaryEventEmitter, SummaryEvents } from '../events/summary-events';

const dataSource = AppDataSource;

export class PaymentClearingController {
  private paymentReceiveRepository = AppDataSource.getRepository(PaymentReceive);
  private companyInfoRepository = AppDataSource.getRepository(CompanyInfo);
  private dictRepository = AppDataSource.getRepository(Dict);
  private dictService = new DictService(this.dictRepository, new RedisCacheService());
  private dataSource = dataSource;

  async importPaymentReceive(req: any, res: Response) {
    try {
      const { receives, batchNo, receiveType } = req.body;
      const userId = (req as any).user?.id;
      if (!userId) {
        return errorResponse(res, 401, '未授权');
      }

      if (!receives || !Array.isArray(receives) || receives.length === 0) {
        return errorResponse(res, 400, '导入数据不能为空');
      }

      const type = parseInt(receiveType) || 1;
      const currentBatchNo = batchNo || (type === 1 ? `BANK${Date.now()}` : `BILL${Date.now()}`);
      const importedRecords: PaymentReceive[] = [];
      const errors: string[] = [];

      const companies = await this.companyInfoRepository.find({
        where: { status: 1 }
      });
      const companyNameToId: Map<string, number> = new Map();
      companies.forEach(company => {
        companyNameToId.set(company.companyName, company.id);
      });

      for (let i = 0; i < receives.length; i++) {
        const item = receives[i];

        if (!item.companyName) {
          return errorResponse(res, 400, `第${i + 1}行：单位名称不能为空`);
        }
        if (!companyNameToId.has(item.companyName)) {
          return errorResponse(res, 400, `第${i + 1}行：单位名称 "${item.companyName}" 不存在于系统中`);
        }

        const payment = new PaymentReceive();
        payment.receiveType = type;
        payment.receiveDate = new Date(item.receiveDate);
        payment.sapCode = item.sapCode || null;
        payment.companyId = companyNameToId.get(item.companyName) || 0;
        payment.customerName = item.customerName || null;
        payment.projectName = item.projectName || null;
        payment.billNo = item.billNo || null;
        payment.accountSet = item.accountSet || null;
        payment.status = 1;
        payment.createdBy = userId;
        payment.updatedBy = userId;
        payment.batchNo = currentBatchNo;

        if (type === 1) {
          if (!item.accountAmount || parseFloat(item.accountAmount) <= 0) {
            errors.push(`第${i + 1}行：到款金额必须大于0`);
            continue;
          }

          const banks = await this.dictService.findByGroup(4);
          const bankNameToId: Map<string, number> = new Map();
          banks.forEach(bank => {
            bankNameToId.set(bank.name, Number(bank.value));
          });

          if (!bankNameToId.has(item.receiveBank)) {
            return errorResponse(res, 400, `第${i + 1}行：到款银行 "${item.receiveBank}" 不存在于系统中`);
          }
          
          payment.receiveBank = bankNameToId.get(item.receiveBank) || 0;
          payment.accountAmount = parseFloat(item.accountAmount);
          payment.received = 1;
        } else {
          if (!item.billNo) {
            errors.push(`第${i + 1}行：票据号码不能为空`);
            continue;
          }
          if (!item.billAmount || parseFloat(item.billAmount) <= 0) {
            errors.push(`第${i + 1}行：票据金额必须大于0`);
            continue;
          }
          if (!item.dueDate) {
            errors.push(`第${i + 1}行：到期日不能为空`);
            continue;
          }

          payment.billNo = item.billNo;
          payment.billType = item.billType || '1';
          payment.billAmount = parseFloat(item.billAmount);
          payment.dueDate = new Date(item.dueDate);
          payment.collectionDate = item.collectionDate ? new Date(item.collectionDate) : null;
          payment.received = item.collectionDate ? 1 : 0;
          payment.discountDate = item.discountDate ? new Date(item.discountDate) : null;
          payment.discountAmount = parseFloat(item.discountAmount) || 0;
          payment.discountFee = parseFloat(item.discountFee) || 0;
          payment.accountAmount = payment.discountAmount > 0 ? payment.discountAmount : payment.billAmount;
        }

        try {
          const saved = await this.paymentReceiveRepository.save(payment);
          importedRecords.push(saved);
        } catch (saveError: any) {
          const errorMsg = saveError.message || '';
          if (errorMsg.includes('UQ_') || errorMsg.includes('unique') || errorMsg.includes('duplicate key')) {
            errors.push(`第${i + 1}行：数据已存在，请检查是否重复导入`);
          } else {
            errors.push(`第${i + 1}行：保存失败 - ${saveError.message}`);
          }
          continue;
        }
      }

      if (errors.length > 0 && importedRecords.length === 0) {
        return successResponse(res, {
          success: false,
          total: receives.length,
          successCount: 0,
          errorCount: errors.length,
          errors
        }, '导入失败', 400);
      }

      return successResponse(res, {
        success: true,
        total: receives.length,
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

  async createReceive(req: any, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return errorResponse(res, 401, '未授权');
      }
      const { 
        receiveType, 
        receiveDate, 
        sapCode, 
        companyId, 
        customerName, 
        projectName, 
        accountAmount, 
        receiveBank, 
        billNo, 
        billType, 
        billAmount, 
        dueDate, 
        collectionDate, 
        accountSet 
      } = req.body;

      if (!receiveType || !receiveDate || !companyId) {
        return errorResponse(res, 400, '必填项不能为空');
      }

      const payment = new PaymentReceive();
      payment.receiveType = parseInt(receiveType);
      payment.receiveDate = new Date(receiveDate);
      payment.sapCode = sapCode || null;
      payment.companyId = parseInt(companyId);
      payment.customerName = customerName || null;
      payment.projectName = projectName || null;
      payment.receiveBank = receiveBank ? parseInt(receiveBank) : 0;
      payment.accountSet = accountSet || null;
      payment.status = 1; // 待确认
      payment.createdBy = userId;
      payment.updatedBy = userId;
      payment.batchNo = `MAN${Date.now()}`;

      if (payment.receiveType === 1) {
        payment.accountAmount = parseFloat(accountAmount) || 0;
        payment.received = 1;
      } else {
        payment.billNo = billNo || null;
        payment.billType = billType || '1';
        payment.billAmount = parseFloat(billAmount) || 0;
        payment.dueDate = dueDate ? new Date(dueDate) : null;
        payment.collectionDate = collectionDate ? new Date(collectionDate) : null;
        payment.received = payment.collectionDate ? 1 : 0;
        payment.accountAmount = payment.accountAmount;
      }

      const saved = await this.paymentReceiveRepository.save(payment);
      return successResponse(res, saved, '创建成功');
    } catch (error: any) {
      console.error('创建收款记录失败:', error);
      return errorResponse(res, 500, `创建失败: ${error.message || error}`);
    }
  }

  async getReceiveList(req: any, res: Response) {
    try {
      const {
        receiveType,
        keyword,
        status,
        batchNo,
        received,
        page = 1,
        size = 10,
        companyId,
        startDate,
        endDate,
        amountFrom,
        amountTo
      } = req.query;
      const pageNum = parseInt(page as string);
      const pageSize = parseInt(size as string);
      const skip = (pageNum - 1) * pageSize;

      let queryBuilder = this.paymentReceiveRepository.createQueryBuilder('receive')
        .innerJoinAndSelect('receive.company', 'company')
        .innerJoinAndSelect('receive.creator', 'creator')
        .innerJoinAndSelect('receive.updater', 'updater')
        .andWhere('receive.status != 4');

      if (receiveType && receiveType > 0) {
        queryBuilder = queryBuilder.andWhere('receive.receiveType = :receiveType', { receiveType: parseInt(receiveType as string) });
      }
      if (keyword) {
        queryBuilder = queryBuilder.andWhere('(company.companyName LIKE :keyword OR receive.customerName LIKE :keyword OR receive.projectName LIKE :keyword)', { keyword: `%${keyword}%` });
      }
      if (status && status > 0) {
        queryBuilder = queryBuilder.andWhere('receive.status = :status', { status: parseInt(status as string) });
      } else {
        queryBuilder = queryBuilder.andWhere('receive.status != 4');
      }
      if (batchNo) {
        queryBuilder = queryBuilder.andWhere('receive.batchNo = :batchNo', { batchNo });
      }
      if (startDate) {
        queryBuilder = queryBuilder.andWhere('receive.receiveDate >= :startDate', { startDate: new Date(startDate as string) });
      }
      if (endDate) {
        queryBuilder = queryBuilder.andWhere('receive.receiveDate <= :endDate', { endDate: new Date(endDate as string) });
      }
      if (received !== undefined) {
        queryBuilder = queryBuilder.andWhere('receive.received = :received', { received: parseInt(received as string) });
      }
      if (amountFrom && amountFrom > 0) {
        queryBuilder = queryBuilder.andWhere('receive.accountAmount >= :amountFrom', { amountFrom: parseInt(amountFrom as string) });
      }
      if (amountTo && amountTo > 0) {
        queryBuilder = queryBuilder.andWhere('receive.accountAmount <= :amountTo', { amountTo: parseInt(amountTo as string) });
      }
      if (companyId) {
        queryBuilder = queryBuilder.andWhere('receive.companyId = :companyId', { companyId: parseInt(companyId as string) });
      }
      if (req.query.accessableCompanyIds) {
        queryBuilder = queryBuilder.andWhere('receive.companyId IN (:...ids)', { ids: req.query.accessableCompanyIds });
      }

      const [records, total] = await queryBuilder
        .select(['receive', 'company', 'creator.name', 'updater.name'])
        .orderBy('receive.createdAt', 'DESC')
        .skip(skip)
        .take(pageSize)
        .getManyAndCount();

      return successResponse(res, { records, total }, '查询成功');
    } catch (error) {
      return errorResponse(res, 500, `查询失败: ${error}`);
    }
  }

  async updateReceive(req: any, res: Response) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const id = parseInt(req.params.id);
      const record = await queryRunner.manager.findOne(PaymentReceive, {
        relations: ['company'],
        where: { id } 
      });

      if (!record) {
        return errorResponse(res, 404, '记录不存在');
      }

      const { 
        collectionDate, 
        discountDate, 
        discountAmount, 
        discountFee, 
        status,
        accountAmount 
      } = req.body;

      if (collectionDate !== undefined) {
        record.collectionDate = collectionDate ? new Date(collectionDate) : null;
        record.received = collectionDate ? 1 : 0;
      }

      if (discountDate !== undefined) {
        record.discountDate = discountDate ? new Date(discountDate) : null;
      }

      if (discountAmount !== undefined) {
        record.discountAmount = parseFloat(discountAmount) || 0;
        record.accountAmount = record.discountAmount > 0 ? record.discountAmount : record.billAmount;
      }

      if (discountFee !== undefined) {
        record.discountFee = parseFloat(discountFee) || 0;
      }

      if (accountAmount !== undefined) {
        record.accountAmount = parseFloat(accountAmount) || 0;
      }

      if (status !== undefined) {
        record.status = parseInt(status);
      }

      const updated = await queryRunner.manager.save(PaymentReceive, record);
      await this._updateDepositIncomingSummary(record.companyId, queryRunner);

      await queryRunner.commitTransaction();

      // 提交后触发事件
      summaryEventEmitter.emit(SummaryEvents.DEPOSIT_LOAN_CHANGED, record.companyId);

      return successResponse(res, updated, '更新成功');
    } catch (error: any) {
      await queryRunner.rollbackTransaction();
      return errorResponse(res, 500, `更新失败: ${error.message || error}`);
    } finally {
      await queryRunner.release();
    }
  }

  async confirmReceive(req: any, res: Response) {
    const queryRunner = this.dataSource.createQueryRunner();
      
    try {
      const { ids } = req.body;
  
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return errorResponse(res, 400, '请选择要确认的记录');
      }
  
      const numIds = ids.map((id: string | number) => parseInt(id as string));
        
      // 开启事务
      await queryRunner.connect();
      await queryRunner.startTransaction();
        
      // 1. 更新状态为已确认（status: 2）
      const result = await queryRunner.manager.update(
        PaymentReceive,
        { id: In(numIds), status: 1 },
        { status: 2 }
      );
        
      if (result.affected === 0) {
        throw new Error('没有记录被更新，可能记录已被确认或不存在');
      }
        
      // 2. 获取涉及的公司 ID
      const companyIds = await queryRunner.manager.createQueryBuilder(PaymentReceive, 'receive')
        .select('receive.companyId', 'companyId')
        .where('receive.id IN (:...ids)', { ids: numIds })
        .distinct(true)
        .getRawMany();
      
      if (companyIds.length > 0) {
        // 3. 为每个公司重新计算到款汇总
        for (const item of companyIds) {
          await this._updateDepositIncomingSummary(parseInt(item.companyId), queryRunner);
        }
      }
        
      await queryRunner.commitTransaction();

      // 4. 提交事务后，异步触发汇总变更事件
      if (companyIds.length > 0) {
        for (const item of companyIds) {
          summaryEventEmitter.emit(SummaryEvents.DEPOSIT_LOAN_CHANGED, parseInt(item.companyId));
        }
      }
        
      return successResponse(res, { affected: result.affected }, `确认成功，共确认 ${result.affected} 条记录`);
    } catch (error: any) {
      // 回滚事务
      await queryRunner.rollbackTransaction();
        
      console.error('确认收款失败:', error);
      return errorResponse(res, 500, `确认失败：${error.message || error}`);
    } finally {
      // 释放连接
      await queryRunner.release();
    }
  }

  private async _updateDepositIncomingSummary(companyId: number, queryRunner: QueryRunner) {
    // 计算到款总额
    const amount = await queryRunner.manager.createQueryBuilder(PaymentReceive, 'payment')
      .select('SUM(CASE WHEN payment.receiveType = 2 AND payment.discountAmount > 0 THEN payment.discountAmount ELSE payment.accountAmount END)', 'receiveAmount')
      .where('payment.companyId = :companyId', { companyId })
      .andWhere('payment.received = 1')
      .andWhere('payment.status = 2')
      .getRawOne();
    
    const receiveAmount = amount.receiveAmount || 0;
    // 查找或创建汇总记录
    let summary = await queryRunner.manager.findOne(DepositLoanSummary, {
      relations: ['company'],
      where: { companyId }
    });
      
    if (!summary) {
      summary = new DepositLoanSummary();
      summary.companyId = companyId;
    }
    summary.depositIncoming = receiveAmount;
    summary.lastStatDate = new Date();
    await queryRunner.manager.save(DepositLoanSummary, summary);
  }

  async deleteReceive(req: any, res: Response) {
    try {
      const { id } = req.body;
      
      const idNum = parseInt(id);
      const record = await this.paymentReceiveRepository.findOne({
        relations: ['company'],
        where: { id: idNum }
      });

      if (!record) {
        return errorResponse(res, 404, '记录不存在');
      }
      if (record.status !== 1) {
        return errorResponse(res, 400, '只能删除未确认的记录');
      }

      record.status = 4;
      await this.paymentReceiveRepository.save(record);

      return successResponse(res, null, '删除成功');
    } catch (error) {
      return errorResponse(res, 500, `删除失败: ${error}`);
    }
  }
}
