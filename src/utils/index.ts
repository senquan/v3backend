/**
 * 日期时间格式化
 * @param time 时间对象或时间戳
 * @param cFormat 格式化模板，默认为 {y}-{m}-{d} {h}:{i}:{s}
 * @returns 格式化后的时间字符串
 */
export function parseTime(time: Date | string | number, cFormat?: string): string | null {
    if (arguments.length === 0) {
      return null
    }
    
    const format = cFormat || "{y}-{m}-{d} {h}:{i}:{s}"
    let date: Date
    
    if (typeof time === "object") {
      date = time as Date
    } else {
      if (typeof time === "string" && /^[0-9]+$/.test(time)) {
        time = parseInt(time)
      }
      if (typeof time === "number" && time.toString().length === 10) {
        time = time * 1000
      }
      date = new Date(time)
    }
    
    const formatObj: Record<string, number> = {
      y: date.getFullYear(),
      m: date.getMonth() + 1,
      d: date.getDate(),
      h: date.getHours(),
      i: date.getMinutes(),
      s: date.getSeconds(),
      a: date.getDay()
    }
    
    const timeStr = format.replace(/{(y|m|d|h|i|s|a)+}/g, (result, key) => {
      let value = formatObj[key]
      // 注意: getDay() 返回 0 表示周日
      if (key === "a") {
        return ["日", "一", "二", "三", "四", "五", "六"][value]
      }
      if (result.length > 0 && value < 10) {
        value = Number(`0${value}`)
      }
      return value.toString() || "0"
    })
    
    return timeStr
  }

import { addDays, addWeeks, addMonths, addYears, nextMonday, nextTuesday, 
  nextWednesday, nextThursday, nextFriday, nextSaturday, nextSunday,
  startOfMonth, endOfMonth, format } from 'date-fns';

// 解析日期表达式的函数
export function parseDateExpression(expression: string, baseDate: Date = new Date()): Date {
  // 复制基准日期，避免修改原始日期
  const date = new Date(baseDate);
  
  // 处理空表达式
  if (!expression || expression.trim() === '') {
    return date;
  }
  
  // 分割表达式，例如 "+1 day" 分割为 ["+1", "day"]
  const parts = expression.trim().split(/\s+/);
  
  if (parts.length < 2) {
    return date; // 表达式格式不正确，返回原始日期
  }
  
  const value = parseInt(parts[0].replace('+', '').replace('-', ''));
  const unit = parts[1].toLowerCase();
  const isAdd = !parts[0].startsWith('-');
  
  switch (unit) {
    case 'day':
    case 'days':
      return isAdd ? addDays(date, value) : addDays(date, -value);
    
    case 'week':
    case 'weeks':
      return isAdd ? addWeeks(date, value) : addWeeks(date, -value);
    
    case 'month':
    case 'months':
      return isAdd ? addMonths(date, value) : addMonths(date, -value);
    
    case 'year':
    case 'years':
      return isAdd ? addYears(date, value) : addYears(date, -value);
    
    case 'weekday':
    case 'weekdays':
      // 这里需要更复杂的逻辑来跳过周末
      let result = date;
      let count = 0;
      while (count < value) {
        result = addDays(result, isAdd ? 1 : -1);
        // 跳过周末 (0 = 周日, 6 = 周六)
        const dayOfWeek = result.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          count++;
        }
      }
      return result;
    
    // 支持直接跳到下一个特定工作日
    case 'monday':
      return nextMonday(date);
    case 'tuesday':
      return nextTuesday(date);
    case 'wednesday':
      return nextWednesday(date);
    case 'thursday':
      return nextThursday(date);
    case 'friday':
      return nextFriday(date);
    case 'saturday':
      return nextSaturday(date);
    case 'sunday':
      return nextSunday(date);
    
    default:
      return date; // 不支持的单位，返回原始日期
  }
}

/**
 * 获取本月第一天的日期
 * @param date 基准日期，默认为当前日期
 * @param formatStr 返回的日期格式，默认为 yyyy-MM-dd
 * @returns 格式化后的本月第一天日期字符串
 */
export function getFirstDayOfMonth(date: Date = new Date(), formatStr: string = 'yyyy-MM-dd'): string {
  const firstDay = startOfMonth(date);
  return format(firstDay, formatStr);
}

/**
 * 获取本月最后一天的日期
 * @param date 基准日期，默认为当前日期
 * @param formatStr 返回的日期格式，默认为 yyyy-MM-dd
 * @returns 格式化后的本月最后一天日期字符串
 */
export function getLastDayOfMonth(date: Date = new Date(), formatStr: string = 'yyyy-MM-dd'): string {
  const lastDay = endOfMonth(date);
  return format(lastDay, formatStr);
}

/**
 * 获取本月的起始日期和结束日期
 * @param date 基准日期，默认为当前日期
 * @param formatStr 返回的日期格式，默认为 yyyy-MM-dd
 * @returns 包含起始日期和结束日期的对象
 */
export function getMonthRange(date: Date = new Date(), formatStr: string = 'yyyy-MM-dd'): { start: string; end: string } {
  return {
    start: getFirstDayOfMonth(date, formatStr),
    end: getLastDayOfMonth(date, formatStr)
  };
}

/**
 * 检查日期格式是否有效
 * @param dateStr 要检查的日期字符串
 * @param format 期望的日期格式，默认为 'yyyy-MM-dd'
 * @returns 如果日期格式有效且日期合法返回 true，否则返回 false
 */
export function checkDate(dateStr: string, format: string = 'yyyy-MM-dd'): boolean {
  if (!dateStr || typeof dateStr !== 'string') {
    return false;
  }

  // 根据不同格式检查日期
  if (format === 'yyyy-MM-dd') {
    // 检查 YYYY-MM-DD 格式
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateStr)) {
      return false;
    }
  } else if (format === 'yyyy-MM-dd HH:mm:ss') {
    // 检查 YYYY-MM-DD HH:MM:SS 格式
    const regex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
    if (!regex.test(dateStr)) {
      return false;
    }
  } else {
    // 其他格式可以根据需要添加
    return false;
  }

  // 验证日期是否有效
  const date = new Date(dateStr);
  
  // 检查日期是否为有效日期（不是 Invalid Date）
  if (isNaN(date.getTime())) {
    return false;
  }

  // 对于 yyyy-MM-dd 格式，还需要检查月份和日期是否匹配
  if (format === 'yyyy-MM-dd') {
    const parts = dateStr.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // 月份从0开始
    const day = parseInt(parts[2], 10);
    
    // 检查解析后的日期是否与输入一致
    return date.getFullYear() === year && 
           date.getMonth() === month && 
           date.getDate() === day;
  }

  return true;
}

// 生成指定长度的随机字符串
export function generateRandomCode(length: number): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}
