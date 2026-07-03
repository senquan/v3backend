/**
 * 内部函数：无符号加法（两个正数字符串相加）
 */
function _addUnsigned(a: string, b: string, scale: number): string {
  const [aInt, aFrac = ""] = a.split(".");
  const [bInt, bFrac = ""] = b.split(".");
  const maxFracLength = Math.max(aFrac.length, bFrac.length);
  let fracSumStr = "";
  let carry = 0;
  if (maxFracLength > 0) {
    const aFracPadded = aFrac.padEnd(maxFracLength, "0");
    const bFracPadded = bFrac.padEnd(maxFracLength, "0");
    const fracSum = BigInt(aFracPadded) + BigInt(bFracPadded);
    fracSumStr = fracSum.toString().padStart(maxFracLength, "0");
    if (fracSumStr.length > maxFracLength) { carry = 1; fracSumStr = fracSumStr.substring(1); }
  }
  const intSum = BigInt(aInt) + BigInt(bInt) + BigInt(carry);
  let result = intSum.toString();
  if (maxFracLength > 0 || scale > 0) result += "." + fracSumStr;
  if (scale >= 0) {
    const parts = result.split(".");
    if (parts.length === 1) { if (scale > 0) result += "." + "0".repeat(scale); }
    else {
      let fracPart = parts[1];
      if (fracPart.length > scale) fracPart = fracPart.substring(0, scale);
      else if (fracPart.length < scale) fracPart = fracPart.padEnd(scale, "0");
      result = scale === 0 ? parts[0] : parts[0] + "." + fracPart;
    }
  }
  return result;
}

/**
 * 内部函数：无符号减法（a >= b，均为正数字符串，结果非负）
 */
function _subUnsigned(a: string, b: string, scale: number): string {
  const [aInt, aFrac = ""] = a.split(".");
  const [bInt, bFrac = ""] = b.split(".");
  const maxFracLength = Math.max(aFrac.length, bFrac.length);
  let fracStr = "";
  let borrow = 0;
  if (maxFracLength > 0) {
    const aFracPadded = aFrac.padEnd(maxFracLength, "0");
    const bFracPadded = bFrac.padEnd(maxFracLength, "0");
    let aFracBig = BigInt(aFracPadded);
    let bFracBig = BigInt(bFracPadded);
    if (aFracBig < bFracBig) { aFracBig += BigInt(10 ** maxFracLength); borrow = 1; }
    const fracDiff = aFracBig - bFracBig;
    fracStr = fracDiff.toString().padStart(maxFracLength, "0");
  }
  const intDiff = BigInt(aInt) - BigInt(bInt) - BigInt(borrow);
  let result = intDiff.toString();
  if (maxFracLength > 0 || scale > 0) result += "." + fracStr;
  if (scale >= 0) {
    const parts = result.split(".");
    if (parts.length === 1) { if (scale > 0) result += "." + "0".repeat(scale); }
    else {
      let fracPart = parts[1];
      if (fracPart.length > scale) fracPart = fracPart.substring(0, scale);
      else if (fracPart.length < scale) fracPart = fracPart.padEnd(scale, "0");
      result = scale === 0 ? parts[0] : parts[0] + "." + fracPart;
    }
  }
  return result;
}

/**
 * 比较两个正数字符串大小
 */
function _compareUnsigned(a: string, b: string): number {
  const [aInt, aFrac = ""] = a.split(".");
  const [bInt, bFrac = ""] = b.split(".");
  const maxFrac = Math.max(aFrac.length, bFrac.length);
  if (BigInt(aInt) > BigInt(bInt)) return 1;
  if (BigInt(aInt) < BigInt(bInt)) return -1;
  if (maxFrac > 0) {
    const aFracPadded = aFrac.padEnd(maxFrac, "0");
    const bFracPadded = bFrac.padEnd(maxFrac, "0");
    if (BigInt(aFracPadded) > BigInt(bFracPadded)) return 1;
    if (BigInt(aFracPadded) < BigInt(bFracPadded)) return -1;
  }
  return 0;
}

/**
 * 高精度加法函数，类似PHP的bcadd
 * 支持正数和负数运算
 *
 * @param leftOperand 第一个操作数
 * @param rightOperand 第二个操作数
 * @param scale 结果保留的小数位数，默认为0
 * @returns 两个操作数相加的结果，以字符串形式返回
 */
export function bcadd(leftOperand: string | number, rightOperand: string | number, scale: number = 0): string {
  const left = typeof leftOperand === "number" ? leftOperand.toString() : leftOperand;
  const right = typeof rightOperand === "number" ? rightOperand.toString() : rightOperand;
  const leftNeg = left.startsWith("-");
  const rightNeg = right.startsWith("-");
  const leftAbs = leftNeg ? left.substring(1) : left;
  const rightAbs = rightNeg ? right.substring(1) : right;
  // 同号：绝对值相加，结果取相同符号
  if (leftNeg === rightNeg) {
    const result = _addUnsigned(leftAbs, rightAbs, scale);
    return leftNeg ? "-" + result : result;
  }
  // 异号：绝对值相减，符号跟随绝对值较大的操作数
  const cmp = _compareUnsigned(leftAbs, rightAbs);
  if (cmp === 0) return scale > 0 ? "0." + "0".repeat(scale) : "0";
  if (cmp > 0) {
    const result = _subUnsigned(leftAbs, rightAbs, scale);
    return leftNeg ? "-" + result : result;
  } else {
    const result = _subUnsigned(rightAbs, leftAbs, scale);
    return rightNeg ? "-" + result : result;
  }
}

/**
 * 高精度减法函数，类似PHP的bcsub
 * 支持正数和负数运算
 *
 * @param leftOperand 第一个操作数
 * @param rightOperand 第二个操作数
 * @param scale 结果保留的小数位数，默认为0
 * @returns 两个操作数相减的结果，以字符串形式返回
 */
export function bcsub(leftOperand: string | number, rightOperand: string | number, scale: number = 0): string {
  const left = typeof leftOperand === "number" ? leftOperand.toString() : leftOperand;
  const right = typeof rightOperand === "number" ? rightOperand.toString() : rightOperand;
  const leftNeg = left.startsWith("-");
  const rightNeg = right.startsWith("-");
  const leftAbs = leftNeg ? left.substring(1) : left;
  const rightAbs = rightNeg ? right.substring(1) : right;
  // 同号：绝对值相减
  if (leftNeg === rightNeg) {
    const cmp = _compareUnsigned(leftAbs, rightAbs);
    if (cmp === 0) return scale > 0 ? "0." + "0".repeat(scale) : "0";
    if (cmp >= 0) {
      const result = _subUnsigned(leftAbs, rightAbs, scale);
      return leftNeg ? "-" + result : result;
    } else {
      const result = _subUnsigned(rightAbs, leftAbs, scale);
      return rightNeg ? result : "-" + result;
    }
  }
  // 异号：绝对值相加，符号跟随第一个操作数
  const result = _addUnsigned(leftAbs, rightAbs, scale);
  return leftNeg ? "-" + result : result;
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
  const left = typeof leftOperand === "number" ? leftOperand.toString() : leftOperand;
  const right = typeof rightOperand === "number" ? rightOperand.toString() : rightOperand;
  const leftNeg = left.startsWith("-");
  const rightNeg = right.startsWith("-");
  const leftAbs = leftNeg ? left.substring(1) : left;
  const rightAbs = rightNeg ? right.substring(1) : right;
  // 计算小数位数
  const leftDecimalPos = leftAbs.indexOf(".");
  const rightDecimalPos = rightAbs.indexOf(".");
  const leftScale = leftDecimalPos === -1 ? 0 : leftAbs.length - leftDecimalPos - 1;
  const rightScale = rightDecimalPos === -1 ? 0 : rightAbs.length - rightDecimalPos - 1;
  // 移除小数点后整数相乘
  const leftInt = leftAbs.replace(".", "");
  const rightInt = rightAbs.replace(".", "");
  const resultInt = BigInt(leftInt || "0") * BigInt(rightInt || "0");
  const resultScale = leftScale + rightScale;
  let resultStr = resultInt.toString();
  if (resultScale > 0) {
    if (resultStr.length <= resultScale) resultStr = "0".repeat(resultScale - resultStr.length + 1) + resultStr;
    resultStr = resultStr.slice(0, -resultScale) + "." + resultStr.slice(-resultScale);
  }
  if (scale >= 0) {
    const parts = resultStr.split(".");
    if (parts.length === 1) { if (scale > 0) resultStr += "." + "0".repeat(scale); }
    else {
      let fracPart = parts[1];
      if (fracPart.length > scale) fracPart = fracPart.substring(0, scale);
      else if (fracPart.length < scale) fracPart = fracPart.padEnd(scale, "0");
      resultStr = scale === 0 ? parts[0] : parts[0] + "." + fracPart;
    }
  }
  // 负负得正
  const isNegative = leftNeg !== rightNeg;
  const isZero = resultInt === BigInt(0);
  if (isNegative && !isZero) resultStr = "-" + resultStr;
  return resultStr;
}