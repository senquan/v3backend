import { Repository } from 'typeorm';
import { calculateSum } from '../utils';
import { ClearingSummary } from '../models/clearing-summary.entity';
import { DepositLoanSummary } from '../models/deposit-loan-summary.entity';
import { summaryEventEmitter, SummaryEvents } from '../events/summary-events';
import { AppDataSource } from '../config/database';

export class ClearingSummaryService {
  private depositLoanSummaryRepository = AppDataSource.getRepository(DepositLoanSummary);

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
}
