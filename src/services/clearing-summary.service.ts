import { Repository } from 'typeorm';
import { calculateSum } from '../utils';
import { AdvanceExpense } from '../models/advance-expense.entity';
import { ClearingSummary } from '../models/clearing-summary.entity';
import { DepositLoanSummary } from '../models/deposit-loan-summary.entity';
import { ProfitPayment } from '../models/profit-payment.entity';
import { summaryEventEmitter, SummaryEvents } from '../events/summary-events';
import { AppDataSource } from '../config/database';

export class ClearingSummaryService {
  private depositLoanSummaryRepository = AppDataSource.getRepository(DepositLoanSummary);
  private advanceExpenseRepository = AppDataSource.getRepository(AdvanceExpense);
  private profitPaymentRepository = AppDataSource.getRepository(ProfitPayment);
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
  }

  /**
   * 同步内部存款余额到清算汇总表
   * 逻辑：internalDepositBalance = depositIncoming + depositTransferUp + depositFromFixed - depositTransferDown - depositToFixed
   */
  async syncInternalDepositBalance(companyId: number) {
    // 1. 获取最新的存款贷款汇总数据 (使用标准存储库以避免 QueryRunner 释放问题)
    const depositSummary = await this.depositLoanSummaryRepository.findOne({
      where: { companyId }
    });

    if (!depositSummary) return;

    // 计算定期存款总额 (来自 JSONB 字段)
    const depositFixedTotal = calculateSum([depositSummary.depositFixed || {}]);

    // 2. 计算内部存款余额 (含利息)
    const internalDepositBalance = 
      Number(depositSummary.depositIncoming || 0) + 
      Number(depositSummary.depositTransferUp || 0) + 
      Number(depositSummary.depositFromFixed || 0) - 
      Number(depositSummary.depositTransferDown || 0) - 
      Number(depositSummary.depositToFixed || 0) +
      depositFixedTotal +
      Number(depositSummary.depositCurrentInterest || 0) +
      Number(depositSummary.depositFixedInterest || 0);

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
      queryBuilder.andWhere('(summary.companyCode LIKE :keyword OR company.companyName LIKE :keyword)', { keyword: `%${keyword}%` });
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

  async findOne(id: number) {
    return await this.clearingSummaryRepository.createQueryBuilder('summary')
      .innerJoin('summary.company', 'company')
      .addSelect('company.companyCode')
      .addSelect('company.companyName')
      .where('summary.id = :id', { id })
      .getOne();
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
}
