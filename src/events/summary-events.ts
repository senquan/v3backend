import { EventEmitter } from 'events';

export const summaryEventEmitter = new EventEmitter();

export const SummaryEvents = {
  // 存款/贷款汇总变更事件
  DEPOSIT_LOAN_CHANGED: 'deposit_loan_changed',
  // 清算汇总变更事件
  CLEARING_CHANGED: 'clearing_changed'
};
