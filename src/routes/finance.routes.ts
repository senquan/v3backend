import { Router } from 'express';
import { CompanyInfo } from '../models/company-info.entity';
import { AppDataSource } from '../config/database';

const router = Router();

const companyRepository = AppDataSource.getRepository(CompanyInfo);

router.get('/companies', (req, res) => {
  res.json({
    code: 200,
    message: '查询成功',
    data: {
      items: [],
      total: 0,
      page: 1,
      size: 10
    }
  });
});

router.get('/deposits', (req, res) => {
  res.json({
    code: 200,
    message: '查询成功',
    data: {
      items: [],
      total: 0,
      page: 1,
      size: 10
    }
  });
});

router.get('/expenses', (req, res) => {
  res.json({
    code: 200,
    message: '查询成功',
    data: {
      items: [],
      total: 0,
      page: 1,
      size: 10
    }
  });
});

router.get('/payments', (req, res) => {
  res.json({
    code: 200,
    message: '查询成功',
    data: {
      items: [],
      total: 0,
      page: 1,
      size: 10
    }
  });
});

function generateMockData(company: CompanyInfo, endDate: string) {
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

router.get('/loan-deposit-summary', async (req, res) => {
  try {
    const { companyName, companyCode, startDate, endDate, page = 1, size = 10 } = req.query;
    const pageNum = parseInt(page as string);
    const pageSize = parseInt(size as string);
    const skip = (pageNum - 1) * pageSize;

    let queryBuilder = companyRepository.createQueryBuilder('company');

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

    const items = companies.map(company => generateMockData(company, endDate as string));

    res.json({
      code: 0,
      message: '查询成功',
      data: { items, total }
    });
  } catch (error) {
    res.json({
      code: 500,
      message: `查询失败: ${error}`,
      data: { items: [], total: 0 }
    });
  }
});

router.get('/loan-deposit-summary/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const company = await companyRepository.findOne({ where: { id } });
    
    if (!company) {
      res.json({
        code: 404,
        message: '记录不存在',
        data: null
      });
      return;
    }

    const item = generateMockData(company, '');

    res.json({
      code: 0,
      message: '查询成功',
      data: item
    });
  } catch (error) {
    res.json({
      code: 500,
      message: `查询失败: ${error}`,
      data: null
    });
  }
});

// import-deposit
router.post('/import-deposit', (req, res) => {
  res.json({
    code: 200,
    message: '导入成功',
    data: null
  });
});

export default router;
