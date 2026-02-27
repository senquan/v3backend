import 'reflect-metadata';
import { AppDataSource } from '../config/database';
import { parseTime } from '../utils';
import { FundTransfer } from '../models/fund-transfer.entity';
import { PaymentReceive } from '../models/payment-receive.entity';
import { FixedDeposit } from '../models/fixed-deposit.entity';
import { CompanyInfo } from '../models/company-info.entity';
import { DailyCurrentInterestDetail } from '../models/current-interest-detail.entity';
import { DailyFixedInterestDetail } from '../models/fixed-interest-detail.entity';
import { FixedToCurrentInterestDetail } from '../models/f2c-interest-detail.entity';
import { InterestRate } from '../models/interest-rate.entity';
import { LessThanOrEqual, MoreThanOrEqual, Between, IsNull } from 'typeorm';

export class InterestCalculationTask {
  private fundTransferRepository = AppDataSource.getRepository(FundTransfer);
  private paymentReceiveRepository = AppDataSource.getRepository(PaymentReceive);
  private fixedDepositRepository = AppDataSource.getRepository(FixedDeposit);
  private companyRepository = AppDataSource.getRepository(CompanyInfo);
  private dailyCurrentInterestRepository = AppDataSource.getRepository(DailyCurrentInterestDetail);
  private dailyFixedInterestRepository = AppDataSource.getRepository(DailyFixedInterestDetail);
  private fixedToCurrentInterestRepository = AppDataSource.getRepository(FixedToCurrentInterestDetail);
  private interestRateRepository = AppDataSource.getRepository(InterestRate);

  async execute() {
    console.log('开始执行利息计算任务...');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    try {
      await this.calculateCurrentInterest(today, tomorrow);
      await this.calculateFixedToCurrentInterest(today);
      await this.calculateFixedInterest(today);
      console.log('利息计算任务执行完成');
      process.exit(0);
    } catch (error) {
      console.error('利息计算任务执行失败:', error);
      process.exit(1);
    }
  }

  private async getDailyRate(): Promise<number> {
    const rate = await this.interestRateRepository.findOne({
      where: { rateType: 1, status: 1 },
      order: { createdAt: 'DESC' }
    });
    if (!rate) {
      throw new Error('未找到生效的活期利率配置');
    }
    return Number(rate.rateValue) / 100 / 360;
  }

  private async calculateCurrentInterest(today: Date, tomorrow: Date) {
    console.log('开始计算活期利息...');
    const dailyRate = await this.getDailyRate();
    console.log(`当前日利率: ${dailyRate}`);

    const companies = await this.companyRepository.find({ where: { status: 1 } });
    console.log(`共 ${companies.length} 个单位`);

    for (const company of companies) {
      // 上划资金、银行到款资金
      const fundTransfers = await this.fundTransferRepository.find({
        where: {
          companyId: company.id,
          transferType: 1,
          transferDate: LessThanOrEqual(today)
        }
      });

      const payments = await this.paymentReceiveRepository.find({
        where: {
          companyId: company.id,
          receiveType: 1,
          receiveDate: LessThanOrEqual(today)
        }
      });

      let totalBalance = 0;
      fundTransfers.forEach(t => totalBalance += Number(t.transferAmount));
      payments.forEach(p => totalBalance += Number(p.accountAmount || 0));

      const dailyInterest = totalBalance * dailyRate;

      const existing = await this.dailyCurrentInterestRepository.findOne({
        where: {
          companyId: company.id,
          interestDate: today
        }
      });

      if (existing) {
        await this.dailyCurrentInterestRepository.update(existing.id, {
          currentBalance: totalBalance,
          dailyRate: dailyRate,
          dailyInterest: dailyInterest
        });
        console.log(`更新单位 ${company.id} 活期利息: 余额=${totalBalance}, 利息=${dailyInterest}`);
      } else {
        await this.dailyCurrentInterestRepository.save({
          companyId: company.id,
          interestDate: today,
          currentBalance: totalBalance,
          dailyRate: dailyRate,
          dailyInterest: dailyInterest
        });
        console.log(`新增单位 ${company.id} 活期利息: 余额=${totalBalance}, 利息=${dailyInterest}`);
      }
    }

    console.log('活期利息计算完成');
  }

  private async calculateFixedToCurrentInterest(today: Date) {
    console.log('开始计算定期转活期利息...');

    const fixedDeposits = await this.fixedDepositRepository.find({
      where: {
        earlyRelease: 1,
        releaseDate: LessThanOrEqual(today),
        status: 2
      }
    });
    console.log(`共 ${fixedDeposits.length} 条提前释放记录`);

    const rate = await this.interestRateRepository.findOne({
      where: { rateType: 1, status: 1 },
      order: { createdAt: 'DESC' }
    });
    const dailyRate = rate ? Number(rate.rateValue) / 100 / 360 : 0;

    for (const deposit of fixedDeposits) {
      const existing = await this.fixedToCurrentInterestRepository.findOne({
        where: {
          depositCode: deposit.depositCode,
          interestStartDate: deposit.startDate
        }
      });

      if (existing) {
        continue;
      }

      const startDate = new Date(deposit.startDate);
      const releaseDate = new Date(deposit.releaseDate!);
      const interestDays = Math.floor((releaseDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

      const interestAmount = Number(deposit.releaseAmount) * dailyRate * interestDays;

      await this.fixedToCurrentInterestRepository.save({
        depositCode: deposit.depositCode,
        companyId: deposit.companyId,
        interestStartDate: deposit.startDate,
        interestReleaseDate: deposit.releaseDate || today,
        releaseAmount: deposit.releaseAmount,
        dailyRate: dailyRate,
        depositPeriod: deposit.depositPeriod,
        interestAmount: interestAmount
      });

      await this.fixedDepositRepository.update(deposit.id, {
        lastInterestDate: today
      });

      console.log(`计算定期转活期利息: ${deposit.depositCode}, 释放金额=${deposit.releaseAmount}, 计息天数=${interestDays}, 利息=${interestAmount}`);
    }

    console.log('定期转活期利息计算完成');
  }

  private async calculateFixedInterest(today: Date) {
    console.log('开始计算定期利息...');

    const fixedDeposits = await this.fixedDepositRepository.find({
      where: {
        status: 2,
        earlyRelease: 0
      }
    });
    console.log(`共 ${fixedDeposits.length} 条定期存款记录`);

    const rate = await this.interestRateRepository.findOne({
      where: { rateType: 1, status: 1 },
      order: { createdAt: 'DESC' }
    });
    const dailyRate = rate ? Number(rate.rateValue) / 100 / 360 : 0;
    console.log(`当前定期日利率: ${dailyRate}`);

    for (const deposit of fixedDeposits) {
      const endDate = new Date(deposit.endDate);
      const lastInterestDate = deposit.lastInterestDate ? new Date(deposit.lastInterestDate) : new Date(deposit.startDate);
      
      if (parseTime(today) !== parseTime(lastInterestDate)) {
        continue;
      }

      const isEstimate = endDate.getTime() !== today.getTime() ? 1 : 0;
      const days = deposit.depositPeriod * 30;

      const interestAmount = Number(deposit.amount) * dailyRate * days;

      await this.dailyFixedInterestRepository.save({
        depositCode: deposit.depositCode,
        companyId: deposit.companyId,
        interestDate: today,
        currentBalance: deposit.amount,
        currentRate: rate ? Number(rate.rateValue) : 0,
        depositPeriod: deposit.depositPeriod,
        interestAmount: interestAmount,
        isEstimate: isEstimate
      });

      console.log(`计算定期利息: ${deposit.depositCode}, 余额=${deposit.amount}, 存期=${deposit.depositPeriod}月, 利息=${interestAmount}, 是否预估=${isEstimate === 1 ? '是' : '否'}`);

      if (isEstimate === 1) {
        const nextInterestDate = new Date(lastInterestDate);
        nextInterestDate.setDate(nextInterestDate.getDate() + 90);

        const daysToEnd = Math.floor((endDate.getTime() - nextInterestDate.getTime()) / (1000 * 60 * 60 * 24));
        
        let newLastInterestDate: Date;
        if (daysToEnd <= 15) {
          newLastInterestDate = endDate;
          console.log(`  -> 下次计息日设置为到期日: ${parseTime(endDate)}`);
        } else {
          newLastInterestDate = nextInterestDate;
          console.log(`  -> 下次计息日: ${parseTime(nextInterestDate)}`);
        }

        await this.fixedDepositRepository.update(deposit.id, {
          lastInterestDate: newLastInterestDate
        });
      }
    }

    console.log('定期利息计算完成');
  }
}

AppDataSource.initialize()
  .then(async () => {
    console.log('数据库连接已初始化');
    const task = new InterestCalculationTask();
    
    setTimeout(() => {
      console.error('任务执行超时');
      process.exit(1);
    }, 30000);
    
    await task.execute();
  })
  .catch((error) => {
    console.error('数据库连接失败:', error);
    process.exit(1);
  });
