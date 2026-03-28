import axios from 'axios';
import { logger } from '../utils/logger';

/**
 * 快递公司代码映射
 */
const EXPRESS_COMPANY_CODES: Record<string, string> = {
  '顺丰速运': 'SF',
  '顺丰': 'SF',
  'SF': 'SF',
  '中通快递': 'ZTO',
  '中通': 'ZTO',
  'ZTO': 'ZTO',
  '圆通速递': 'YTO',
  '圆通': 'YTO',
  'YTO': 'YTO',
  '韵达快递': 'YUNDA',
  '韵达': 'YUNDA',
  'YUNDA': 'YUNDA',
  '申通快递': 'STO',
  '申通': 'STO',
  'STO': 'STO',
  'EMS': 'EMS',
  '京东物流': 'JD',
  '京东': 'JD',
  'JD': 'JD',
  '中国邮政': 'YZPY',
  '邮政': 'YZPY',
  'YZPY': 'YZPY',
  '百世快递': 'HTKY',
  '百世': 'HTKY',
  'HTKY': 'HTKY',
  '天天快递': 'HHTT',
  '天天': 'HHTT',
  'HHTT': 'HHTT',
  '德邦快递': 'DBL',
  '德邦': 'DBL',
  'DBL': 'DBL',
  '宅急送': 'ZJS',
  'ZJS': 'ZJS',
  '极兔速递': 'JT',
  '极兔': 'JT',
  'JT': 'JT',
  '安能物流': 'ANE',
  '安能': 'ANE',
  'ANE': 'ANE',
  '跨越速运': 'KYSY',
  '跨越': 'KYSY',
  'KYSY': 'KYSY',
  '优速快递': 'US',
  '优速': 'US',
  'US': 'US',
};

/**
 * 物流状态映射
 */
const LOGISTICS_STATUS_MAP: Record<number, string> = {
  0: '在途',
  1: '揽收',
  2: '疑难',
  3: '签收',
  4: '退签',
  5: '退回',
  6: '投递',
  7: '转寄',
  8: '派件',
  9: '退回',
};

/**
 * 物流轨迹节点
 */
export interface LogisticsNode {
  time: string;
  status: string;
  location: string;
  description: string;
}

/**
 * 物流查询结果
 */
export interface LogisticsResult {
  success: boolean;
  company: string;
  number: string;
  status: string;
  statusCode: number;
  isFinal: boolean;
  updatedAt: string;
  nodes: LogisticsNode[];
  error?: string;
}

/**
 * 物流查询服务
 * 基于快递100 API实现
 */
export class ExpressLogisticsService {
  // 快递100 API配置
  private readonly API_URL = 'https://api.kdniao.com/Eorder/EorderService';
  private readonly API_KEY = process.env.KDniao_API_KEY || '';
  private readonly CUSTOMER = process.env.KDniao_CUSTOMER || '';

  /**
   * 查询物流信息
   */
  async query(trackingNumber: string, companyCode?: string): Promise<LogisticsResult> {
    // 如果没有提供快递公司代码，尝试自动识别
    let company = companyCode;
    if (!company) {
      company = this.identifyCompany(trackingNumber) || '';
    }

    if (!company) {
      return {
        success: false,
        company: '未知',
        number: trackingNumber,
        status: '识别失败',
        statusCode: -1,
        isFinal: false,
        updatedAt: new Date().toISOString(),
        nodes: [],
        error: '无法识别快递公司'
      };
    }

    try {
      const result = await this.queryFromKDNiao(trackingNumber, company);
      return result;
    } catch (error: any) {
      logger.error(`物流查询失败: ${trackingNumber}`, error);
      return {
        success: false,
        company,
        number: trackingNumber,
        status: '查询失败',
        statusCode: -1,
        isFinal: false,
        updatedAt: new Date().toISOString(),
        nodes: [],
        error: error.message
      };
    }
  }

  /**
   * 从快递100 API查询
   */
  private async queryFromKDNiao(trackingNumber: string, companyCode: string): Promise<LogisticsResult> {
    const requestData = {
      OrderCode: '',
      ShipperCode: companyCode,
      LogisticCode: trackingNumber,
      IsNotice: 0,
    };

    const dataStr = JSON.stringify(requestData);
    const sign = this.sign(dataStr);

    const response = await axios.post(
      this.API_URL,
      {
        RequestData: dataStr,
        EBussinessID: this.CUSTOMER,
        RequestType: '1002',
        DataSign: sign,
        DataType: '2',
      },
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 10000,
      }
    );

    const result = response.data;

    if (!result.Success) {
      return {
        success: false,
        company: this.getCompanyName(companyCode),
        number: trackingNumber,
        status: result.Reason || '查询失败',
        statusCode: -1,
        isFinal: false,
        updatedAt: new Date().toISOString(),
        nodes: [],
        error: result.Reason
      };
    }

    const traces = result.Traces || [];
    const nodes: LogisticsNode[] = traces.map((trace: any) => ({
      time: trace.AcceptTime,
      status: trace.AcceptStation,
      location: '',
      description: trace.AcceptStation,
    }));

    // 最后一个状态为最新状态
    const latestStatus = nodes.length > 0 ? nodes[0].status : '未知';
    const statusCode = this.extractStatusCode(latestStatus);
    const isFinal = this.isFinalStatus(statusCode);

    return {
      success: true,
      company: this.getCompanyName(companyCode),
      number: trackingNumber,
      status: latestStatus,
      statusCode,
      isFinal,
      updatedAt: nodes.length > 0 ? nodes[0].time : new Date().toISOString(),
      nodes: nodes.reverse(), // 按时间正序
    };
  }

  /**
   * 自动识别快递公司
   */
  identifyCompany(trackingNumber: string): string | null {
    // 顺丰: SF开头，或12位数字
    if (/^SF/i.test(trackingNumber) || /^\d{12}$/.test(trackingNumber)) {
      return 'SF';
    }

    // EMS: E开头
    if (/^E[A-Z]/i.test(trackingNumber)) {
      return 'EMS';
    }

    // 京东: JD开头
    if (/^JD/i.test(trackingNumber)) {
      return 'JD';
    }

    // 中通: 以7开头，12-15位
    if (/^7\d{11,14}$/.test(trackingNumber)) {
      return 'ZTO';
    }

    // 韵达: 以10或19开头，13位
    if (/^(10|19)\d{11}$/.test(trackingNumber)) {
      return 'YUNDA';
    }

    // 圆通: 以8开头，10-12位
    if (/^8\d{9,10}$/.test(trackingNumber)) {
      return 'YTO';
    }

    // 申通: 以88或89开头，10位
    if (/^(88|89)\d{8}$/.test(trackingNumber)) {
      return 'STO';
    }

    // 百世: 以W或B开头
    if (/^[WB]\d{12}$/i.test(trackingNumber)) {
      return 'HTKY';
    }

    return null;
  }

  /**
   * 获取公司名称
   */
  private getCompanyName(code: string): string {
    const nameMap: Record<string, string> = {
      'SF': '顺丰速运',
      'ZTO': '中通快递',
      'YTO': '圆通速递',
      'YUNDA': '韵达快递',
      'STO': '申通快递',
      'EMS': 'EMS',
      'JD': '京东物流',
      'HTKY': '百世快递',
      'YZPY': '中国邮政',
      'HHTT': '天天快递',
      'DBL': '德邦快递',
      'ZJS': '宅急送',
      'JT': '极兔速递',
      'ANE': '安能物流',
      'KYSY': '跨越速运',
      'US': '优速快递',
    };
    return nameMap[code] || code;
  }

  /**
   * 提取状态码
   */
  private extractStatusCode(statusText: string): number {
    const text = statusText.toLowerCase();

    if (text.includes('签收') || text.includes('已取') || text.includes('本人')) {
      return 3; // 签收
    }
    if (text.includes('退签')) {
      return 4; // 退签
    }
    if (text.includes('退回') || text.includes('退件')) {
      return 5; // 退回
    }
    if (text.includes('揽收') || text.includes('收件')) {
      return 1; // 揽收
    }
    if (text.includes('派件') || text.includes('投递')) {
      return 8; // 派件
    }
    if (text.includes('转寄')) {
      return 7; // 转寄
    }
    if (text.includes('疑难') || text.includes('问题')) {
      return 2; // 疑难
    }

    return 0; // 在途
  }

  /**
   * 判断是否为终态
   */
  private isFinalStatus(statusCode: number): boolean {
    return [3, 4, 5].includes(statusCode); // 签收、退签、退回为终态
  }

  /**
   * 签名
   */
  private sign(dataStr: string): string {
    const crypto = require('crypto');
    const signStr = dataStr + this.API_KEY;
    const md5 = crypto.createHash('md5');
    md5.update(signStr);
    return md5.digest('base64');
  }
}

// 导出单例
export const expressLogisticsService = new ExpressLogisticsService();
