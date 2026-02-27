import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

import { AdvanceExpense } from '../models/advance-expense.entity';
import { AdvanceExpenseDetail } from '../models/advance-expense-detail.entity';
import { AdvanceExpenseType } from '../models/advance-expense-type.entity';
import { ClearingSummary } from '../models/clearing-summary.entity';
import { CompanyInfo } from '../models/company-info.entity';
import { DailyCurrentInterestDetail } from '../models/current-interest-detail.entity';
import { DailyFixedInterestDetail } from '../models/fixed-interest-detail.entity';
import { FixedToCurrentInterestDetail } from '../models/f2c-interest-detail.entity';
import { DepositLoanSummary } from '../models/deposit-loan-summary.entity';
import { Dict } from '../models/dict.entity';
import { FundTransfer } from '../models/fund-transfer.entity';
import { InviteCode } from '../models/invite-code.entity';
import { Permission } from '../models/permission.entity';
import { Role } from '../models/role.entity';
import { RolePermission } from '../models/role-permission.entity';
import { Settings } from '../models/settings.entity';
import { User } from '../models/user.entity';
import { UserRole } from '../models/user-roles.entity';
import { InterestRate } from '../models/interest-rate.entity';
import { InternalDeposit } from '../models/internal-deposit.entity';
import { ProfitPayment } from '../models/profit-payment.entity';
import { FixedDeposit } from '../models/fixed-deposit.entity';
import { PaymentReceive } from '../models/payment-receive.entity';

// 加载环境变量
dotenv.config();

// 创建数据源
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'password',
  database: process.env.DB_NAME || 'training',
  schema: process.env.DB_SCHEMA || 'fms',
  synchronize: process.env.NODE_ENV !== 'production', // 开发环境自动同步数据库结构
  logging: process.env.NODE_ENV !== 'production',
  entities: [ClearingSummary, CompanyInfo, DailyCurrentInterestDetail, DailyFixedInterestDetail, FixedToCurrentInterestDetail, DepositLoanSummary, Dict,
    FundTransfer, InviteCode, Permission, Role, RolePermission, User, UserRole,
    InterestRate, InternalDeposit, AdvanceExpense, AdvanceExpenseDetail, AdvanceExpenseType, ProfitPayment, FixedDeposit, Settings, PaymentReceive],
  migrations: [__dirname + '/../migrations/**/*.ts'],
  subscribers: [__dirname + '/../subscribers/**/*.ts'],
});