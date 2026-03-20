import { Repository, LessThanOrEqual } from 'typeorm';
import { AdvanceExpense } from '../models/advance-expense.entity';
import { ClearingSummary } from '../models/clearing-summary.entity';
import { DepositLoanSummary } from '../models/deposit-loan-summary.entity';
import { ProfitPayment } from '../models/profit-payment.entity';
import { FixedDeposit } from '../models/fixed-deposit.entity';
import { FundTransfer } from '../models/fund-transfer.entity';
import { PaymentReceive } from '../models/payment-receive.entity';
import { ClearingSnapshot } from '../models/clearing-snapshot.entity';
import { ClearingSnapshotData } from '../models/clearing-snapshot-data.entity';
import { CompanyInfo } from '../models/company-info.entity';
import { summaryEventEmitter, SummaryEvents } from '../events/summary-events';
import { AppDataSource } from '../config/database';

export class ClearingSummaryService {
  private depositLoanSummaryRepository = AppDataSource.getRepository(DepositLoanSummary);
  private advanceExpenseRepository = AppDataSource.getRepository(AdvanceExpense);
  private profitPaymentRepository = AppDataSource.getRepository(ProfitPayment);
  private companyRepository = AppDataSource.getRepository(CompanyInfo);
  private snapshotRepository = AppDataSource.getRepository(ClearingSnapshot);
  private snapshotDataRepository = AppDataSource.getRepository(ClearingSnapshotData);
  private fundTransferRepository = AppDataSource.getRepository(FundTransfer);
  private paymentReceiveRepository = AppDataSource.getRepository(PaymentReceive);
  private fixedDepositRepository = AppDataSource.getRepository(FixedDeposit);

  constructor(
    private clearingSummaryRepository: Repository<ClearingSummary>,
  ) {
    this.initEventListeners();
  }

  private initEventListeners() {
    // 监听存款贷款汇总变更事件，同步更新清算汇总的内部存款余额
    // 注意：事件通常在事务提交后触发，因此这里使用标准的存储库进行查询和保存
    summaryEventEmitter.on(SummaryEvents.DEPOSIT_LOAN_CHANGED, async (companyId: number) => {
      try {
        await this.syncInternalDepositBalance(companyId);
      } catch (error) {
        console.error(`[ClearingSummaryService] 同步单位 ${companyId} 余额失败:`, error);
      }
    });

    // 各项代垫费用汇总计算
    summaryEventEmitter.on(SummaryEvents.ADVANCE_EXPENSE_CHANGED, async (companyId: number) => {
      try {
        await this.syncAdvanceExpense(companyId);
      } catch (error) {
        console.error(`[ClearingSummaryService] 同步单位 ${companyId} 代垫费用失败:`, error);
      }
    });

    // 利润上缴汇总计算
    summaryEventEmitter.on(SummaryEvents.PROFIT_PAYMENT_CHANGED, async (companyId: number) => {
      try {
        await this.syncProfitPayment(companyId);
      } catch (error) {
        console.error(`[ClearingSummaryService] 同步单位 ${companyId} 利润上缴失败:`, error);
      }
    });

    // 上划下拨变动
    summaryEventEmitter.on(SummaryEvents.TRANSFER_CHANGED, async (companyId: number) => {
      try {
        await this.syncDepositLoanBalance(companyId);
      } catch (error) {
        console.error(`[ClearingSummaryService] 同步单位 ${companyId} 存贷款余额失败:`, error);
      }
    });

    // 到款变动
    summaryEventEmitter.on(SummaryEvents.RECEIVED_CHANGED, async (companyId: number) => {
      try {
        await this.syncDepositIncoming(companyId);
      } catch (error) {
        console.error(`[ClearingSummaryService] 同步单位 ${companyId} 到款余额失败:`, error);
      }
    });

    // 定期转入转出变动
    summaryEventEmitter.on(SummaryEvents.FIXED_DEPOSIT_CHANGED, async (companyId: number) => {
      try {
        await this.syncDepositFixed(companyId);
      } catch (error) {
        console.error(`[ClearingSummaryService] 同步单位 ${companyId} 定期出入余额失败:`, error);
      }
    });
  }

  /**
   * 同步内部存款余额到清算汇总表
   * 逻辑：internalDepositBalance = depositIncoming + depositTransferUp + depositFromFixed - depositTransferDown - depositToFixed
   */
  async syncInternalDepositBalance(companyId: number) {
    // 1. 获取最新的存款贷款汇总数据 (使用标准存储库以避免 QueryRunner 释放问题)
    const depositSummary = await this.depositLoanSummaryRepository.findOne({
      relations: ['company'],
      where: { companyId }
    });

    if (!depositSummary) return;

    // 2. 计算内部存款余额 (含利息)
    const internalDepositBalance = depositSummary.getInternalDepositBalance();

    // 3. 更新或创建清算汇总记录
    let clearingSummary = await this.clearingSummaryRepository.findOne({
      relations: ['company'],
      where: { companyId }
    });

    if (!clearingSummary) {
      clearingSummary = new ClearingSummary();
      clearingSummary.companyId = companyId;
    }

    clearingSummary.internalDepositBalance = internalDepositBalance;
    clearingSummary.lastStatDate = new Date();
    
    await this.clearingSummaryRepository.save(clearingSummary);
    console.log(`[ClearingSummaryService] 已同步单位 ${companyId} 的内部存款余额: ${internalDepositBalance}`);
  }

  /**
   * 同步各项代垫费用到清算汇总表
   */
  async syncAdvanceExpense(companyId: number) {
    // 1. 获取最新的代垫费用数据
    const advanceExpense = await this.advanceExpenseRepository.find({
      where: { companyId, status: 2 }
    });

    if (!advanceExpense) return;

    // 2. 按类型汇总
    const advanceExpenseTotal = advanceExpense.reduce((acc, item) => {
      acc[item.expenseType] = (acc[item.expenseType] || 0) + Number(item.amount || 0);
      return acc;
    }, {} as Record<number, number>);

    // 3. 更新或创建清算汇总记录
    let clearingSummary = await this.clearingSummaryRepository.findOne({
      relations: ['company'],
      where: { companyId }
    });
    
    if (!clearingSummary) {
      clearingSummary = new ClearingSummary();
      clearingSummary.companyId = companyId;
    }

    clearingSummary.incomeTaxSettlement = advanceExpenseTotal[1] || 0;  // 所得税清算
    clearingSummary.dueBillAdvance = advanceExpenseTotal[2] || 0;  // 局集团代垫到期票据款
    clearingSummary.expenseAdvance = advanceExpenseTotal[3] || 0;  // 代垫费用
    clearingSummary.salaryAdvance = advanceExpenseTotal[4] || 0;  // 代垫职工薪酬
    clearingSummary.lastStatDate = new Date();
    
    await this.clearingSummaryRepository.save(clearingSummary);
    console.log(`[ClearingSummaryService] 已同步单位 ${companyId} 的各项代垫费用: ${JSON.stringify(advanceExpenseTotal)}`);
  }

  /**
   * 同步利润上缴到清算汇总表
   */
  async syncProfitPayment(companyId: number) {
    // 1. 获取本年度最新的利润上缴数据
    const profitPayment = await this.profitPaymentRepository.findOne({
      where: { companyId, status: 2, businessYear: new Date().getFullYear() }
    });
    if (!profitPayment) return;

    // 3. 更新或创建清算汇总记录
    let clearingSummary = await this.clearingSummaryRepository.findOne({
      relations: ['company'],
      where: { companyId }
    });
    
    if (!clearingSummary) {
      clearingSummary = new ClearingSummary();
      clearingSummary.companyId = companyId;
    }

    clearingSummary.dueProfit1 = profitPayment.dueProfit1 || 0;
    clearingSummary.dueProfit2 = profitPayment.dueProfit2 || 0;
    clearingSummary.profitPaid = profitPayment.actualAmount || 0;
    clearingSummary.lastStatDate = new Date();
    
    await this.clearingSummaryRepository.save(clearingSummary);
    console.log(`[ClearingSummaryService] 已同步单位 ${companyId} 的利润上缴: ${profitPayment.dueProfit1} / ${profitPayment.dueProfit2} / ${profitPayment.actualAmount}`);
  }
  /**
   * 上划下拨变动
   */
  async syncDepositLoanBalance(companyId: number) {

    let summary = await this.depositLoanSummaryRepository.findOne({
      relations: ['company'],
      where: { companyId }
    });

    if (!summary) {
      summary = new DepositLoanSummary();
      summary.companyId = companyId;
    }
    const transferResult = await this.fundTransferRepository.createQueryBuilder('transfer')
      .where('transfer.companyId = :companyId', { companyId })
      .andWhere('transfer.transferStatus = 2')  
      .getMany();
    let totalUp = 0;
    let totalLoan = 0;
    let totalDown = 0;
    for (const item of transferResult) {
      if (item.transferType === 1) {
        totalUp += Number(item.transferAmount);
      } else {
        if (item.isLoan === 1) {
          totalLoan += Number(item.transferAmount);
        } else {
          totalDown += Number(item.transferAmount);
        }
      }
    }
    summary.depositTransferUp = totalUp;
    summary.depositTransferDown = totalDown;
    summary.loanBalance = totalLoan;
    summary.lastStatDate = new Date();
    await this.depositLoanSummaryRepository.save(summary);

    // 更新清算汇总表
    await this.syncInternalDepositBalance(companyId);
  }
  /**
   * 到款变动
   */
  async syncDepositIncoming(companyId: number) {
    let summary = await this.depositLoanSummaryRepository.findOne({
      relations: ['company'],
      where: { companyId }
    });
    if (!summary) {
      summary = new DepositLoanSummary();
      summary.companyId = companyId;
    }
    const payment = await this.paymentReceiveRepository.createQueryBuilder('payment')
      .select('SUM(CASE WHEN payment.receiveType = 2 AND payment.discountAmount > 0 THEN payment.discountAmount ELSE payment.accountAmount END)', 'receiveAmount')
      .where('payment.companyId = :companyId', { companyId })
      .andWhere('payment.received = 1')
      .andWhere('payment.status = 2')
      .getRawOne();
    const receiveAmount = payment.receiveAmount || 0;
    summary.depositIncoming = receiveAmount;
    summary.lastStatDate = new Date();
    await this.depositLoanSummaryRepository.save(summary);

    // 更新清算汇总表
    await this.syncInternalDepositBalance(companyId);
  }
  /**
   * 定期变动
   */
  async syncDepositFixed(companyId: number) {
    // 计算活期转入定期总额 (depositToFixed) 及现有定期
    const toFixedResult = await this.fixedDepositRepository.createQueryBuilder('deposit')
      .where('deposit.companyId = :companyId', { companyId })
      .andWhere('deposit.status = 2')
      .getMany();
      
    let depositToFixed = 0;
    const depositFixedObj: Record<string, number> = {};
    for (const item of toFixedResult) {
      const periodKey = item.depositPeriod.toString();
      depositFixedObj[periodKey] = Number(item.remainingAmount) + (depositFixedObj[periodKey] || 0);
      if (item.depositType === 2) {
        depositToFixed += Number(item.remainingAmount);
      }
    }

    // 计算定期转入活期总额 (depositFromFixed)
    const fromFixedResult = await this.fixedDepositRepository.createQueryBuilder('deposit')
      .select('SUM(deposit.releaseAmount)', 'total')
      .where('deposit.companyId = :companyId', { companyId })
      .andWhere('deposit.status = 2')
      .andWhere('deposit.earlyRelease = 1')
      .getRawOne();
    const depositFromFixed = parseFloat(fromFixedResult.total) || 0;

    // 查找或创建汇总记录
    let summary = await this.depositLoanSummaryRepository.findOne({
      relations: ['company'],
      where: { companyId }
    });
    if (!summary) {
      summary = new DepositLoanSummary();
      summary.companyId = companyId;
    }

    summary.depositToFixed = depositToFixed;
    summary.depositFromFixed = depositFromFixed;
    summary.depositFixed = depositFixedObj;
    summary.lastStatDate = new Date();
    await this.depositLoanSummaryRepository.save(summary);

    // 更新清算汇总表
    await this.syncInternalDepositBalance(companyId);
  }

  async findAll(query: any) {
    const { page = 1, size = 10, keyword } = query;
    const pageNum = parseInt(page as string);
    const pageSize = parseInt(size as string);
    const skip = (pageNum - 1) * pageSize;

    const queryBuilder = this.clearingSummaryRepository.createQueryBuilder('summary')
      .innerJoin('summary.company', 'company')
      .addSelect('company.companyCode')
      .addSelect('company.companyName')
      .where('1=1');

    if (keyword) {
      queryBuilder.andWhere('(company.companyCode LIKE :keyword OR company.companyName LIKE :keyword)', { keyword: `%${keyword}%` });
    }

    if (query.accessableCompanyIds) {
      queryBuilder.andWhere('summary.companyId IN (:...ids)', { ids: query.accessableCompanyIds });
    }

    queryBuilder.orderBy('summary.sort', 'ASC')
      .addOrderBy('summary.lastStatDate', 'DESC')
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

  async findOne(id: number, query: any) {

    const queryBuilder = this.clearingSummaryRepository.createQueryBuilder('summary')
      .innerJoin('summary.company', 'company')
      .addSelect('company.companyCode')
      .addSelect('company.companyName')
      .where('summary.id = :id', { id });

    if (query.accessableCompanyIds) {
      queryBuilder.andWhere('summary.companyId IN (:...ids)', { ids: query.accessableCompanyIds });
    }

    return await queryBuilder.getOne();
  }

  async findByCompanyId(companyId: number) {
    return await this.clearingSummaryRepository.findOne({
      where: { companyId }
    });
  }

  /**
   * 更新清算汇总记录
   */
  async update(id: number, data: any) {
    const existing = await this.clearingSummaryRepository.findOne({
      relations: ['company'],
      where: { id }
    });
    if (!existing) return null;

    Object.assign(existing, data);
    return await this.clearingSummaryRepository.save(existing);
  }

  /**
   * 快照相关
   */
  
  /**
   * 创建清算台账快照
   * @param name 快照名称
   * @param cutoffDate 截至日期
   * @param userId 创建人ID
   */
  async createSnapshot(name: string, cutoffDate: Date, userId: number) {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    const startTime = new Date().getTime();
    try {
      // 1. 创建快照主记录
      const snapshot = new ClearingSnapshot();
      snapshot.snapshotName = name;
      snapshot.cutoffDate = cutoffDate;
      snapshot.createdById = userId;
      const savedSnapshot = await queryRunner.manager.save(snapshot);

      // 2. 获取所有单位
      const companies = await queryRunner.manager.find(CompanyInfo, { where: { status: 1 } });

      // 3. 计算并保存每个单位在截至日期的汇总数据
      for (const company of companies) {
        const companyId = company.id;
        
        // 计算内部存款余额 (截至日期前已确认的数据)
        const paymentSum = await queryRunner.manager.createQueryBuilder(PaymentReceive, 'payment')
          .select('SUM(payment.accountAmount)', 'total')
          .where('payment.companyId = :companyId', { companyId })
          .andWhere('payment.received = 1')
          .andWhere('payment.status = 2')
          .andWhere('payment.receiveDate <= :cutoffDate', { cutoffDate })
          .getRawOne();
        
        const transferUpSum = await queryRunner.manager.createQueryBuilder(FundTransfer, 'transfer')
          .select('SUM(transfer.transferAmount)', 'total')
          .where('transfer.companyId = :companyId', { companyId })
          .andWhere('transfer.transferType = 1')
          .andWhere('transfer.transferStatus = 2')
          .andWhere('transfer.transferDate <= :cutoffDate', { cutoffDate })
          .getRawOne();
          
        const transferDownSum = await queryRunner.manager.createQueryBuilder(FundTransfer, 'transfer')
          .select('SUM(transfer.transferAmount)', 'total')
          .where('transfer.companyId = :companyId', { companyId })
          .andWhere('transfer.transferType = 2')
          .andWhere('transfer.transferStatus = 2')
          .andWhere('transfer.transferDate <= :cutoffDate', { cutoffDate })
          .getRawOne();

        const fixedToFixedSum = await queryRunner.manager.createQueryBuilder(FixedDeposit, 'deposit')
          .select('SUM(deposit.remainingAmount)', 'total')
          .where('deposit.companyId = :companyId', { companyId })
          .andWhere('deposit.status = 2')
          .andWhere('deposit.startDate <= :cutoffDate', { cutoffDate })
          .getRawOne();
        
        const releaseSum = await queryRunner.manager.createQueryBuilder(FixedDeposit, 'deposit')
          .select('SUM(deposit.releaseAmount)', 'total')
          .where('deposit.companyId = :companyId', { companyId })
          .andWhere('deposit.status = 2')
          .andWhere('deposit.earlyRelease = 1')
          .andWhere('deposit.releaseDate <= :cutoffDate', { cutoffDate })
          .getRawOne();

        const internalDepositBalance = 
          Number(paymentSum.total || 0) + 
          Number(transferUpSum.total || 0) + 
          Number(releaseSum.total || 0) - 
          Number(transferDownSum.total || 0) - 
          Number(fixedToFixedSum.total || 0);

        // 计算各项代垫费用
        const getExpenseSum = async (typeId: number) => {
          const res = await queryRunner.manager.createQueryBuilder(AdvanceExpense, 'expense')
            .select('SUM(expense.amount)', 'total')
            .where('expense.companyId = :companyId', { companyId })
            .andWhere('expense.expenseType = :typeId', { typeId })
            .andWhere('expense.status = 2')
            .andWhere('expense.updatedAt <= :cutoffDate', { cutoffDate })
            .getRawOne();
          return Number(res.total || 0);
        };

        const incomeTaxSettlement = await getExpenseSum(1); // 所得税
        const dueBillAdvance = await getExpenseSum(2);    // 代垫票据
        const expenseAdvance = await getExpenseSum(3);     // 代垫费用
        const salaryAdvance = await getExpenseSum(4);      // 代垫薪酬

        // 计算上缴利润
        const profitSum = await queryRunner.manager.createQueryBuilder(ProfitPayment, 'profit')
          .select('SUM(profit.dueProfit1)', 'totalDue1')
          .addSelect('SUM(profit.dueProfit2)', 'totalDue2')
          .addSelect('SUM(profit.actualAmount)', 'totalPaid')
          .where('profit.companyId = :companyId', { companyId })
          .andWhere('profit.status = 2')
          .andWhere('profit.businessYear <= :year', { year: cutoffDate.getFullYear() })
          .getRawOne();

        const snapshotData = new ClearingSnapshotData();
        snapshotData.snapshotId = savedSnapshot.id;
        snapshotData.companyId = companyId;
        snapshotData.internalDepositBalance = internalDepositBalance;
        snapshotData.incomeTaxSettlement = incomeTaxSettlement;
        snapshotData.dueBillAdvance = dueBillAdvance;
        snapshotData.expenseAdvance = expenseAdvance;
        snapshotData.salaryAdvance = salaryAdvance;
        snapshotData.dueProfit1 = Number(profitSum.totalDue1 || 0);
        snapshotData.dueProfit2 = Number(profitSum.totalDue2 || 0);
        snapshotData.profitPaid = Number(profitSum.totalPaid || 0);
        snapshotData.lastStatDate = new Date();
        
        await queryRunner.manager.save(snapshotData);
      }

      await queryRunner.commitTransaction();
      const endTime = new Date().getTime();
      console.log(`创建快照耗时: ${endTime - startTime}ms`);
      return savedSnapshot;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 获取快照明细穿透数据
   */
  async getSnapshotDrillDown(snapshotId: number, companyId: number, field: string) {
    const snapshot = await this.snapshotRepository.findOne({ where: { id: snapshotId } });
    if (!snapshot) throw new Error('快照不存在');

    const cutoffDate = snapshot.cutoffDate;

    switch (field) {
      case 'internalDepositBalance':
        // 穿透到 PaymentReceive, FundTransfer, FixedDeposit
        const payments = await AppDataSource.getRepository(PaymentReceive).find({
          where: { companyId, status: 2, receiveDate: LessThanOrEqual(cutoffDate) },
          relations: ['company']
        });
        const transfers = await AppDataSource.getRepository(FundTransfer).find({
          where: { companyId, transferStatus: 2, transferDate: LessThanOrEqual(cutoffDate) },
          relations: ['company']
        });
        return { payments, transfers };
      case 'expenseAdvance':
      case 'incomeTaxSettlement':
      case 'dueBillAdvance':
      case 'salaryAdvance':
        // 穿透到 AdvanceExpense
        const typeMap: Record<string, number> = {
          'incomeTaxSettlement': 1,
          'dueBillAdvance': 2,
          'expenseAdvance': 3,
          'salaryAdvance': 4
        };
        return await AppDataSource.getRepository(AdvanceExpense).find({
          where: { 
            companyId, 
            status: 2, 
            expenseType: typeMap[field],
            updatedAt: LessThanOrEqual(cutoffDate)
          },
          relations: ['company', 'type']
        });

      case 'profitPaid':
        return await AppDataSource.getRepository(ProfitPayment).find({
          where: { 
            companyId, 
            status: 2,
            businessYear: LessThanOrEqual(cutoffDate.getFullYear())
          },
          relations: ['company']
        });

      default:
        return [];
    }
  }

  async getSnapshotList(query: any) {
    const { page = 1, size = 10 } = query;
    const [records, total] = await this.snapshotRepository.findAndCount({
      relations: ['creator'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * size,
      take: size
    });
    return { records, total };
  }

  async getSnapshotData(snapshotId: number) {
    return await this.snapshotDataRepository.find({
      where: { snapshotId },
      relations: ['company']
    });
  }
}
