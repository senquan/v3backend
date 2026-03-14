import { EventEmitter } from 'events';

export const summaryEventEmitter = new EventEmitter();

export const SummaryEvents = {

  // 存款代垫清算台账汇总
  // 存款/贷款汇总变更事件
  DEPOSIT_LOAN_CHANGED: 'deposit_loan_changed',
  // 各项代垫费用汇总变更事件
  ADVANCE_EXPENSE_CHANGED: 'advance_expense_changed',
  // 利润上缴汇总变更事件
  PROFIT_PAYMENT_CHANGED: 'profit_payment_changed',

  // 操作日志事件
  LOG_TYPE_MODIFY: 2,
  LOG_TYPE_CONFIRM: 5,
  LOG_OPERATIONS: 'log_operations',
};
