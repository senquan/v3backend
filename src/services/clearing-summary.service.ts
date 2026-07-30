import { Repository, LessThanOrEqual, In } from 'typeorm';
import { AdvanceExpense } from '../models/advance-expense.entity';
import { ClearingSummary } from '../models/clearing-summary.entity';
import { DepositLoanSummary } from '../models/deposit-loan-summary.entity';
import { ProfitPayment } from '../models/profit-payment.entity';
import { FixedDeposit } from '../models/fixed-deposit.entity';
import { FixedToCurrentInterestDetail } from '../models/f2c-interest-detail.entity';
import { FundTransfer } from '../models/fund-transfer.entity';
import { PaymentReceive } from '../models/payment-receive.entity';
import { ClearingSnapshot } from '../models/clearing-snapshot.entity';
import { ClearingSnapshotData } from '../models/clearing-snapshot-data.entity';
import { SnapshotDetailLink } from '../models/clearing-snapshot-detail-link.entity';
import { CompanyInfo } from '../models/company-info.entity';
import { summaryEventEmitter, SummaryEvents } from '../events/summary-events';
import { AppDataSource } from '../config/database';
import { DailyCurrentInterestDetail } from '../models/current-interest-detail.entity';
import { DailyFixedInterestDetail } from '../models/fixed-interest-detail.entity';

export class ClearingSummaryService {
  private depositLoanSummaryRepository = AppDataSource.getRepository(DepositLoanSummary);
  private advanceExpenseRepository = AppDataSource.getRepository(AdvanceExpense);
  private profitPaymentRepository = AppDataSource.getRepository(ProfitPayment);
  private companyRepository = AppDataSource.getRepository(CompanyInfo);
  private snapshotRepository = AppDataSource.getRepository(ClearingSnapshot);
  private snapshotDataRepository = AppDataSource.getRepository(ClearingSnapshotData);
  private snapshotLinkRepository = AppDataSource.getRepository(SnapshotDetailLink);
  private fundTransferRepository = AppDataSource.getRepository(FundTransfer);
  private paymentReceiveRepository = AppDataSource.getRepository(PaymentReceive);
  private fixedDepositRepository = AppDataSource.getRepository(FixedDeposit);
  private dailyCurrentInterestRepository = AppDataSource.getRepository(DailyCurrentInterestDetail);
  private fixedToCurrentInterestRepository = AppDataSource.getRepository(FixedToCurrentInterestDetail);

  constructor(
    private clearingSummaryRepository: Repository<ClearingSummary>,
  ) {
    this.initEventListeners();
  }

  private initEventListeners() {
    summaryEventEmitter.on(SummaryEvents.DEPOSIT_LOAN_CHANGED, async (companyId: number) => {
      try { await this.syncInternalDepositBalance(companyId); }
      catch (error) { console.error(`[ClearingSummaryService] 同步单位 ${companyId} 余额失败:`, error); }
    });

    // 各项代垫费用汇总计算
    summaryEventEmitter.on(SummaryEvents.ADVANCE_EXPENSE_CHANGED, async (companyId: number) => {
      try { await this.syncAdvanceExpense(companyId); }
      catch (error) { console.error(`[ClearingSummaryService] 同步单位 ${companyId} 代垫费用失败:`, error); }
    });
    summaryEventEmitter.on(SummaryEvents.PROFIT_PAYMENT_CHANGED, async (companyId: number) => {
      try { await this.syncProfitPayment(companyId); }
      catch (error) { console.error(`[ClearingSummaryService] 同步单位 ${companyId} 利润上缴失败:`, error); }
    });
    summaryEventEmitter.on(SummaryEvents.TRANSFER_CHANGED, async (companyId: number) => {
      try { await this.syncDepositLoanBalance(companyId); }
      catch (error) { console.error(`[ClearingSummaryService] 同步单位 ${companyId} 存贷款余额失败:`, error); }
    });
    summaryEventEmitter.on(SummaryEvents.RECEIVED_CHANGED, async (companyId: number) => {
      try { await this.syncDepositIncoming(companyId); }
      catch (error) { console.error(`[ClearingSummaryService] 同步单位 ${companyId} 到款余额失败:`, error); }
    });
    summaryEventEmitter.on(SummaryEvents.FIXED_DEPOSIT_CHANGED, async (companyId: number) => {
      try { await this.syncDepositFixed(companyId); }
      catch (error) { console.error(`[ClearingSummaryService] 同步单位 ${companyId} 定期出入余额失败:`, error); }
    });
  }

  async syncInternalDepositBalance(companyId: number) {
    if (!companyId) return;
    const depositSummary = await this.depositLoanSummaryRepository.findOne({
      relations: ['company'],
      where: { companyId }
    });
    if (!depositSummary) return;
    const internalDepositBalance = depositSummary.getInternalDepositBalance();
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
  }

  async syncAdvanceExpense(companyId: number) {
    if (!companyId) return;
    const advanceExpense = await this.advanceExpenseRepository.find({
      where: { companyId, status: 2 }
    });
    const activeRecords = advanceExpense.filter(r => r.expenseType >= 1 && r.expenseType <= 4);
    const advanceExpenseTotal = activeRecords.reduce((acc, item) => {
      acc[item.expenseType] = (acc[item.expenseType] || 0) + Number(item.amount || 0);
      return acc;
    }, {} as Record<number, number>);
    let clearingSummary = await this.clearingSummaryRepository.findOne({
      relations: ['company'],
      where: { companyId }
    });
    if (!clearingSummary) {
      clearingSummary = new ClearingSummary();
      clearingSummary.companyId = companyId;
    }
    clearingSummary.incomeTaxSettlement = advanceExpenseTotal[1] || 0;
    clearingSummary.dueBillAdvance = advanceExpenseTotal[2] || 0;
    clearingSummary.expenseAdvance = advanceExpenseTotal[3] || 0;
    clearingSummary.salaryAdvance = advanceExpenseTotal[4] || 0;
    clearingSummary.lastStatDate = new Date();
    await this.clearingSummaryRepository.save(clearingSummary);
  }

  /**
   * 同步利润上缴到清算汇总表
   */
  async syncProfitPayment(companyId: number) {
    if (!companyId) return;
    const profitPayment = await this.profitPaymentRepository.findOne({
      where: { companyId, status: 2, businessYear: new Date().getFullYear() }
    });
    if (!profitPayment) return;
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
  }
  /**
   * 上划下拨变动
   */
  async syncDepositLoanBalance(companyId: number) {
    if (!companyId) return;
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
    let totalUp = 0, totalLoan = 0, totalDown = 0;
    for (const item of transferResult) {
      if (item.transferType === 1) { totalUp += Number(item.transferAmount); }
      else if (item.isLoan === 1) { totalLoan += Number(item.transferAmount); }
      else { totalDown += Number(item.transferAmount); }
    }
    summary.depositTransferUp = totalUp;
    summary.depositTransferDown = totalDown;
    summary.loanBalance = totalLoan;
    summary.lastStatDate = new Date();
    await this.depositLoanSummaryRepository.save(summary);
    await this.syncInternalDepositBalance(companyId);
  }

  async syncDepositIncoming(companyId: number) {
    if (!companyId) return;
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
    await this.syncInternalDepositBalance(companyId);
  }

  async syncDepositFixed(companyId: number) {
    if (!companyId) return;
    const toFixedResult = await this.fixedDepositRepository.createQueryBuilder('deposit')
      .where('deposit.companyId = :companyId', { companyId })
      .andWhere('deposit.status = 2')
      .getMany();
    let depositToFixed = 0;
    const depositFixedObj: Record<string, number> = {};
    for (const item of toFixedResult) {
      const periodKey = item.depositPeriod.toString();
      depositFixedObj[periodKey] = Number(item.remainingAmount) + (depositFixedObj[periodKey] || 0);
      if (item.depositType === 2) { depositToFixed += Number(item.remainingAmount); }
    }
    const fromFixedResult = await this.fixedDepositRepository.createQueryBuilder('deposit')
      .select('SUM(deposit.releaseAmount)', 'total')
      .where('deposit.companyId = :companyId', { companyId })
      .andWhere('deposit.status = 2')
      .andWhere('deposit.earlyRelease = 1')
      .getRawOne();
    const depositFromFixed = parseFloat(fromFixedResult.total) || 0;
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

    // 活期利息 = 每日活期利息 + 定期提前释放活期利息（合并列项）
    const dailyResult = await this.dailyCurrentInterestRepository
      .createQueryBuilder('detail')
      .select('SUM(detail.dailyInterest)', 'total')
      .where('detail.companyId = :companyId', { companyId })
      .getRawOne();
    const f2cResult = await this.fixedToCurrentInterestRepository
      .createQueryBuilder('detail')
      .select('SUM(detail.interestAmount)', 'total')
      .where('detail.companyId = :companyId', { companyId })
      .getRawOne();
    summary.depositCurrentInterest =
      (parseFloat(dailyResult?.total) || 0) + (parseFloat(f2cResult?.total) || 0);

    summary.lastStatDate = new Date();
    await this.depositLoanSummaryRepository.save(summary);
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
    queryBuilder.orderBy('summary.sort', 'DESC').addOrderBy('summary.lastStatDate', 'DESC').skip(skip).take(pageSize);
    const [records, total] = await queryBuilder.getManyAndCount();

    // 实时计算 internalDepositBalance
    for (const record of records) {
      const depositSummary = await this.depositLoanSummaryRepository.findOne({
        relations: ['company'],
        where: { companyId: record.companyId }
      });
      if (depositSummary) {
        record.internalDepositBalance = depositSummary.getInternalDepositBalance();
      }
    }

    return { records, total, page: pageNum, size: pageSize };
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
    return await this.clearingSummaryRepository.findOne({ where: { companyId } });
  }

  async update(id: number, data: any) {
    const existing = await this.clearingSummaryRepository.findOne({ relations: ['company'], where: { id } });
    if (!existing) return null;
    Object.assign(existing, data);
    return await this.clearingSummaryRepository.save(existing);
  }
/**
 * 创建清算台账快照（含中间表关联）
 */
async createSnapshot(name: string, cutoffDate: Date, userId: number) {
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();
  const startTime = new Date().getTime();
  try {
    const snapshot = new ClearingSnapshot();
    snapshot.snapshotName = name;
    snapshot.cutoffDate = cutoffDate;
    snapshot.createdById = userId;
    const savedSnapshot = await queryRunner.manager.save(snapshot);

    const companies = await queryRunner.manager.find(CompanyInfo, { where: { status: 1 } });
    const linksToSave: SnapshotDetailLink[] = [];

    const saveLink = (sourceTable: string, sourceId: number, companyId: number, field: string) => {
      linksToSave.push({
        id: undefined as any,
        snapshotId: savedSnapshot.id,
        sourceTable,
        sourceId,
        companyId,
        field,
      } as SnapshotDetailLink);
    };

    for (const company of companies) {
      const companyId = company.id;

      // === 内部存款余额计算 ===
      const paymentSum = await queryRunner.manager.createQueryBuilder(PaymentReceive, 'payment')
        .select('SUM(CASE WHEN payment.receiveType = 2 AND payment.discountAmount > 0 THEN payment.discountAmount ELSE payment.accountAmount END)', 'total')
        .where('payment.companyId = :companyId', { companyId })
        .andWhere('payment.received = 1')
        .andWhere('payment.status = 2')
        .andWhere('payment.receiveDate <= :cutoffDate', { cutoffDate })
        .getRawOne();
      const paymentIds = await queryRunner.manager.createQueryBuilder(PaymentReceive, 'p')
        .select('p.id')
        .where('p.companyId = :companyId', { companyId })
        .andWhere('p.received = 1')
        .andWhere('p.status = 2')
        .andWhere('p.receiveDate <= :cutoffDate', { cutoffDate })
        .getRawMany();
      for (const r of paymentIds) saveLink('payment_receive', Number(r.id), companyId, 'internalDepositBalance');

      const transferUpSum = await queryRunner.manager.createQueryBuilder(FundTransfer, 'transfer')
        .select('SUM(transfer.transferAmount)', 'total')
        .where('transfer.companyId = :companyId', { companyId })
        .andWhere('transfer.transferType = 1')
        .andWhere('transfer.transferStatus = 2')
        .andWhere('transfer.transferDate <= :cutoffDate', { cutoffDate })
        .getRawOne();
      const transferUpIds = await queryRunner.manager.createQueryBuilder(FundTransfer, 't')
        .select('t.id')
        .where('t.companyId = :companyId', { companyId })
        .andWhere('t.transferType = 1')
        .andWhere('t.transferStatus = 2')
        .andWhere('t.transferDate <= :cutoffDate', { cutoffDate })
        .getRawMany();
      for (const r of transferUpIds) saveLink('fund_transfer', Number(r.id), companyId, 'internalDepositBalance');

      const transferDownSum = await queryRunner.manager.createQueryBuilder(FundTransfer, 'transfer')
        .select('SUM(transfer.transferAmount)', 'total')
        .where('transfer.companyId = :companyId', { companyId })
        .andWhere('transfer.transferType = 2')
        .andWhere('transfer.transferStatus = 2')
        .andWhere('transfer.isLoan = 0')
        .andWhere('transfer.transferDate <= :cutoffDate', { cutoffDate })
        .getRawOne();
      const transferDownIds = await queryRunner.manager.createQueryBuilder(FundTransfer, 't')
        .select('t.id')
        .where('t.companyId = :companyId', { companyId })
        .andWhere('t.transferType = 2')
        .andWhere('t.transferStatus = 2')
        .andWhere('t.isLoan = 0')
        .andWhere('t.transferDate <= :cutoffDate', { cutoffDate })
        .getRawMany();
      for (const r of transferDownIds) saveLink('fund_transfer', Number(r.id), companyId, 'internalDepositBalance');

      const releaseSum = await queryRunner.manager.createQueryBuilder(FixedDeposit, 'deposit')
        .select('SUM(deposit.releaseAmount)', 'total')
        .where('deposit.companyId = :companyId', { companyId })
        .andWhere('deposit.status = 2')
        .andWhere('deposit.earlyRelease = 1')
        .andWhere('deposit.releaseDate <= :cutoffDate', { cutoffDate })
        .getRawOne();
      const releaseIds = await queryRunner.manager.createQueryBuilder(FixedDeposit, 'd')
        .select('d.id')
        .where('d.companyId = :companyId', { companyId })
        .andWhere('d.status = 2')
        .andWhere('d.earlyRelease = 1')
        .andWhere('d.releaseDate <= :cutoffDate', { cutoffDate })
        .getRawMany();
      for (const r of releaseIds) saveLink('fixed_deposit', Number(r.id), companyId, 'internalDepositBalance');

      const depositToFixed = await queryRunner.manager.createQueryBuilder(FixedDeposit, 'deposit')
        .select('SUM(deposit.remainingAmount)', 'total')
        .where('deposit.companyId = :companyId', { companyId })
        .andWhere('deposit.status = 2')
        .andWhere('deposit.depositType = 2')
        .andWhere('deposit.startDate <= :cutoffDate', { cutoffDate })
        .getRawOne();
      const toFixedIds = await queryRunner.manager.createQueryBuilder(FixedDeposit, 'd')
        .select('d.id')
        .where('d.companyId = :companyId', { companyId })
        .andWhere('d.status = 2')
        .andWhere('d.depositType = 2')
        .andWhere('d.startDate <= :cutoffDate', { cutoffDate })
        .getRawMany();
      for (const r of toFixedIds) saveLink('fixed_deposit', Number(r.id), companyId, 'internalDepositBalance');

      const depositFixedTotal = await queryRunner.manager.createQueryBuilder(FixedDeposit, 'deposit')
        .select('SUM(deposit.remainingAmount)', 'total')
        .where('deposit.companyId = :companyId', { companyId })
        .andWhere('deposit.status = 2')
        .andWhere('deposit.startDate <= :cutoffDate', { cutoffDate })
        .getRawMany();
      for (const r of depositFixedTotal) saveLink('fixed_deposit', Number(r.id), companyId, 'internalDepositBalance');

      const currentInterestSum = await queryRunner.manager.createQueryBuilder(DailyCurrentInterestDetail, 'detail')
        .select('SUM(detail.dailyInterest)', 'total')
        .where('detail.companyId = :companyId', { companyId })
        .andWhere('detail.interestDate <= :cutoffDate', { cutoffDate })
        .getRawOne();
      const currentInterestIds = await queryRunner.manager.createQueryBuilder(DailyCurrentInterestDetail, 'd')
        .select('d.id')
        .where('d.companyId = :companyId', { companyId })
        .andWhere('d.interestDate <= :cutoffDate', { cutoffDate })
        .getRawMany();
      for (const r of currentInterestIds) saveLink('daily_current_interest_detail', Number(r.id), companyId, 'internalDepositBalance');

      // 定期提前释放活期利息（合并入活期利息，下穿明细体现）
      const f2cInterestSum = await queryRunner.manager.createQueryBuilder(FixedToCurrentInterestDetail, 'detail')
        .select('SUM(detail.interestAmount)', 'total')
        .where('detail.companyId = :companyId', { companyId })
        .andWhere('detail.interestReleaseDate <= :cutoffDate', { cutoffDate })
        .getRawOne();
      const f2cInterestIds = await queryRunner.manager.createQueryBuilder(FixedToCurrentInterestDetail, 'd')
        .select('d.id')
        .where('d.companyId = :companyId', { companyId })
        .andWhere('d.interestReleaseDate <= :cutoffDate', { cutoffDate })
        .getRawMany();
      for (const r of f2cInterestIds) saveLink('fixed_to_current_interest_detail', Number(r.id), companyId, 'internalDepositBalance');

      const fixedInterestSum = await queryRunner.manager.createQueryBuilder(DailyFixedInterestDetail, 'detail')
        .select('SUM(detail.interestAmount)', 'total')
        .where('detail.companyId = :companyId', { companyId })
        .andWhere('detail.interestDate <= :cutoffDate', { cutoffDate })
        .getRawOne();
      const fixedInterestIds = await queryRunner.manager.createQueryBuilder(DailyFixedInterestDetail, 'd')
        .select('d.id')
        .where('d.companyId = :companyId', { companyId })
        .andWhere('d.interestDate <= :cutoffDate', { cutoffDate })
        .getRawMany();
      for (const r of fixedInterestIds) saveLink('daily_fixed_interest_detail', Number(r.id), companyId, 'internalDepositBalance');

      const internalDepositBalance =
        Number(company.initCurrentBalance || 0) +
        Number(paymentSum.total || 0) +
        Number(transferUpSum.total || 0) +
        Number(releaseSum.total || 0) -
        Number(transferDownSum.total || 0) -
        Number(depositToFixed.total || 0) +
        Number(depositFixedTotal[0]?.remainingAmount || 0) +
        Number(currentInterestSum.total || 0) +
        Number(f2cInterestSum.total || 0) +
        Number(fixedInterestSum.total || 0);

      // === 代垫费用 ===
      const getExpenseSum = async (typeId: number, field: string) => {
        const result = await queryRunner.manager.createQueryBuilder(AdvanceExpense, 'expense')
          .select(['SUM(expense.amount) as total', 'expense.id'])
          .where('expense.companyId = :companyId', { companyId })
          .andWhere('expense.expenseType = :typeId', { typeId })
          .andWhere('expense.status = 2')
          .andWhere('expense.updatedAt <= :cutoffDate', { cutoffDate })
          .groupBy('expense.id')
          .getRawMany();
        for (const r of result) saveLink('advance_expense', Number(r.id), companyId, field);
        const total = result.reduce((s, r) => s + Number(r.total || 0), 0);
        return total;
      };
      const incomeTaxSettlement = await getExpenseSum(1, 'incomeTaxSettlement');
      const dueBillAdvance = await getExpenseSum(2, 'dueBillAdvance');
      const expenseAdvance = await getExpenseSum(3, 'expenseAdvance');
      const salaryAdvance = await getExpenseSum(4, 'salaryAdvance');

      // === 利润上缴 ===
      const profitSum = await queryRunner.manager.createQueryBuilder(ProfitPayment, 'profit')
        .select(['SUM(profit.dueProfit1)', 'SUM(profit.dueProfit2)', 'SUM(profit.actualAmount)', 'profit.id'])
        .where('profit.companyId = :companyId', { companyId })
        .andWhere('profit.status = 2')
        .andWhere('profit.businessYear <= :year', { year: cutoffDate.getFullYear() })
        .groupBy('profit.id')
        .getRawMany();
      for (const r of profitSum) saveLink('profit_payment', Number(r.id), companyId, 'profitPaid');
      const totalDue1 = profitSum.reduce((s, r) => s + Number(r['SUM(profit.dueProfit1)'] || 0), 0);
      const totalDue2 = profitSum.reduce((s, r) => s + Number(r['SUM(profit.dueProfit2)'] || 0), 0);
      const totalPaid = profitSum.reduce((s, r) => s + Number(r['SUM(profit.actualAmount)'] || 0), 0);

      const snapshotData = new ClearingSnapshotData();
      snapshotData.snapshotId = savedSnapshot.id;
      snapshotData.companyId = companyId;
      snapshotData.internalDepositBalance = internalDepositBalance;
      snapshotData.incomeTaxSettlement = incomeTaxSettlement;
      snapshotData.dueBillAdvance = dueBillAdvance;
      snapshotData.expenseAdvance = expenseAdvance;
      snapshotData.salaryAdvance = salaryAdvance;
      snapshotData.dueProfit1 = totalDue1;
      snapshotData.dueProfit2 = totalDue2;
      snapshotData.profitPaid = totalPaid;
      snapshotData.billAmount = 0;
      snapshotData.other = 0;
      snapshotData.contactBalance = 0;
      snapshotData.lastStatDate = new Date();
      await queryRunner.manager.save(snapshotData);
    }

    if (linksToSave.length > 0) {
      await queryRunner.manager.save(linksToSave);
      console.log(`[createSnapshot] 保存了 ${linksToSave.length} 条明细关联记录`);
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
   * 获取快照明细穿透数据（通过中间表关联）
   */
  async getSnapshotDrillDown(snapshotId: number, companyId: number, field: string) {
    const snapshot = await this.snapshotRepository.findOne({ where: { id: snapshotId } });
    if (!snapshot) throw new Error('快照不存在');

    const sourceTableMap: Record<string, string> = {
      'internalDepositBalance': 'payment_receive',
      'incomeTaxSettlement': 'advance_expense',
      'dueBillAdvance': 'advance_expense',
      'expenseAdvance': 'advance_expense',
      'salaryAdvance': 'advance_expense',
      'profitPaid': 'profit_payment',
      'dueProfit1': 'profit_payment',
      'dueProfit2': 'profit_payment',
    };

    const sourceTable = sourceTableMap[field];
    if (!sourceTable) return [];

    const typeMap: Record<string, number> = {
      'incomeTaxSettlement': 1,
      'dueBillAdvance': 2,
      'expenseAdvance': 3,
      'salaryAdvance': 4
    };

    // 1. 查询中间表获取该快照关联的源记录ID
    const links = await this.snapshotLinkRepository.find({
      where: { snapshotId, companyId, field },
    });
    const sourceIds = links.map(l => l.sourceId);

    if (sourceIds.length === 0) return { records: [] as any[], sourceTable };

    // 2. 根据源记录ID查询源表数据（包含已软删除的记录，以反映快照时状态）
    let records: any[] = [];
    switch (sourceTable) {
      case 'payment_receive': {
        records = await AppDataSource.getRepository(PaymentReceive).find({
          where: { id: In(sourceIds) },
          relations: ['company'],
          withDeleted: true,
        });
        break;
      }
      case 'fund_transfer': {
        records = await AppDataSource.getRepository(FundTransfer).find({
          where: { id: In(sourceIds) },
          relations: ['company'],
        });
        break;
      }
      case 'fixed_deposit': {
        records = await AppDataSource.getRepository(FixedDeposit).find({
          where: { id: In(sourceIds) },
          relations: ['company'],
        });
        break;
      }
      case 'advance_expense': {
        const expenseType = typeMap[field];
        records = await AppDataSource.getRepository(AdvanceExpense).find({
          where: { id: In(sourceIds), expenseType: expenseType },
          relations: ['company', 'type', 'details'],
        });
        break;
      }
      case 'profit_payment': {
        records = await AppDataSource.getRepository(ProfitPayment).find({
          where: { id: In(sourceIds) },
          relations: ['company'],
        });
        break;
      }
      case 'daily_current_interest_detail': {
        records = await AppDataSource.getRepository(DailyCurrentInterestDetail).find({
          where: { id: In(sourceIds) },
        });
        break;
      }
      case 'daily_fixed_interest_detail': {
        records = await AppDataSource.getRepository(DailyFixedInterestDetail).find({
          where: { id: In(sourceIds) },
        });
        break;
      }
    }

    return { records, sourceTable, totalCount: records.length, sourceIds };
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

  async getSnapshotLinks(snapshotId: number, companyId?: number) {
    const where: any = { snapshotId };
    if (companyId) where.companyId = companyId;
    return await this.snapshotLinkRepository.find({ where });
  }
}
