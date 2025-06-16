/**
 * 高精度加法函数，类似PHP的bcadd
 * 
 * @param leftOperand 第一个操作数
 * @param rightOperand 第二个操作数
 * @param scale 结果保留的小数位数，默认为0
 * @returns 两个操作数相加的结果，以字符串形式返回
 */
export function bcadd(leftOperand: string | number, rightOperand: string | number, scale: number = 0): string {
  // 将输入转换为字符串
  const left = typeof leftOperand === 'number' ? leftOperand.toString() : leftOperand;
  const right = typeof rightOperand === 'number' ? rightOperand.toString() : rightOperand;

  // 分离整数部分和小数部分
  const [leftInt, leftFrac = ''] = left.split('.');
  const [rightInt, rightFrac = ''] = right.split('.');

  // 计算小数部分
  const maxFracLength = Math.max(leftFrac.length, rightFrac.length);
  const leftFracPadded = leftFrac.padEnd(maxFracLength, '0');
  const rightFracPadded = rightFrac.padEnd(maxFracLength, '0');

  // 将小数部分转换为整数进行计算
  const fracSum = BigInt(leftFracPadded) + BigInt(rightFracPadded);
  let fracSumStr = fracSum.toString().padStart(maxFracLength, '0');

  // 处理小数部分的进位
  let carry = 0;
  if (fracSumStr.length > maxFracLength) {
    carry = 1;
    fracSumStr = fracSumStr.substring(1);
  }

  // 计算整数部分
  const intSum = BigInt(leftInt) + BigInt(rightInt) + BigInt(carry);
  
  // 组合结果
  let result = intSum.toString();
  if (maxFracLength > 0 || scale > 0) {
    // 如果需要小数部分
    result += '.' + fracSumStr;
  }

  // 处理精度
  if (scale >= 0) {
    const parts = result.split('.');
    if (parts.length === 1) {
      // 如果结果没有小数部分但需要精度
      if (scale > 0) {
        result += '.' + '0'.repeat(scale);
      }
    } else {
      // 调整小数部分的长度
      const intPart = parts[0];
      let fracPart = parts[1];
      
      if (fracPart.length > scale) {
        // 截断
        fracPart = fracPart.substring(0, scale);
      } else if (fracPart.length < scale) {
        // 补零
        fracPart = fracPart.padEnd(scale, '0');
      }
      
      result = scale === 0 ? intPart : `${intPart}.${fracPart}`;
    }
  }

  return result;
}

/**
 * 高精度减法函数，类似PHP的bcsub
 * 
 * @param leftOperand 第一个操作数
 * @param rightOperand 第二个操作数
 * @param scale 结果保留的小数位数，默认为0
 * @returns 两个操作数相减的结果，以字符串形式返回
 */
export function bcsub(leftOperand: string | number, rightOperand: string | number, scale: number = 0): string {
  // 将第二个操作数变为负数，然后调用bcadd
  const right = typeof rightOperand === 'number' 
    ? -rightOperand 
    : rightOperand.startsWith('-') 
      ? rightOperand.substring(1) 
      : `-${rightOperand}`;
  
  return bcadd(leftOperand, right, scale);
}

/**
 * 高精度乘法函数，类似PHP的bcmul
 * 
 * @param leftOperand 第一个操作数
 * @param rightOperand 第二个操作数
 * @param scale 结果保留的小数位数，默认为0
 * @returns 两个操作数相乘的结果，以字符串形式返回
 */
export function bcmul(leftOperand: string | number, rightOperand: string | number, scale: number = 0): string {
  // 将输入转换为字符串
  const left = typeof leftOperand === 'number' ? leftOperand.toString() : leftOperand;
  const right = typeof rightOperand === 'number' ? rightOperand.toString() : rightOperand;

  // 计算小数点位置
  const leftDecimalPos = left.indexOf('.');
  const rightDecimalPos = right.indexOf('.');
  
  // 计算小数位数
  const leftScale = leftDecimalPos === -1 ? 0 : left.length - leftDecimalPos - 1;
  const rightScale = rightDecimalPos === -1 ? 0 : right.length - rightDecimalPos - 1;
  
  // 移除小数点，转换为整数计算
  const leftInt = left.replace('.', '');
  const rightInt = right.replace('.', '');
  
  // 计算结果
  const resultInt = BigInt(leftInt) * BigInt(rightInt);
  
  // 计算结果的小数位数
  const resultScale = leftScale + rightScale;
  
  // 转换为字符串
  let resultStr = resultInt.toString();
  
  // 插入小数点
  if (resultScale > 0) {
    if (resultStr.length <= resultScale) {
      // 需要在前面补0
      resultStr = '0'.repeat(resultScale - resultStr.length + 1) + resultStr;
    }
    
    resultStr = resultStr.slice(0, -resultScale) + '.' + resultStr.slice(-resultScale);
  }
  
  // 处理精度
  if (scale >= 0) {
    const parts = resultStr.split('.');
    if (parts.length === 1) {
      // 如果结果没有小数部分但需要精度
      if (scale > 0) {
        resultStr += '.' + '0'.repeat(scale);
      }
    } else {
      // 调整小数部分的长度
      const intPart = parts[0];
      let fracPart = parts[1];
      
      if (fracPart.length > scale) {
        // 截断
        fracPart = fracPart.substring(0, scale);
      } else if (fracPart.length < scale) {
        // 补零
        fracPart = fracPart.padEnd(scale, '0');
      }
      
      resultStr = scale === 0 ? intPart : `${intPart}.${fracPart}`;
    }
  }
  
  return resultStr;
}