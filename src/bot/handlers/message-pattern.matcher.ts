import { logger } from '../../utils/logger';

interface MatchResult {
  type: ExpressMessageType;
  expressCompany?: string;
  trackingNumber?: string;
  reason?: string;
  rawText: string;
}

type ExpressMessageType = 
  | 'INTERCEPTION_REQUEST'
  | 'INTERCEPTION_SUCCESS'
  | 'INTERCEPTION_FAILED'
  | 'REJECT'
  | 'NOT_RECEIVED'
  | 'ADDRESS_ISSUE'
  | 'DAMAGE'
  | 'LOST'
  | 'HELLO'
  | 'HELP'
  | 'QUERY'
  | 'UNKNOWN';

/**
 * 快递公司映射表
 */
const EXPRESS_COMPANY_MAP: Record<string, string> = {
  '顺丰': '顺丰速运',
  'SF': '顺丰速运',
  'EMS': 'EMS',
  '中通': '中通快递',
  'ZTO': '中通快递',
  '圆通': '圆通速递',
  'YTO': '圆通速递',
  '韵达': '韵达快递',
  'YUNDA': '韵达快递',
  '申通': '申通快递',
  'STO': '申通快递',
  '百世': '百世快递',
  'BEST': '百世快递',
  '京东': '京东物流',
  'JD': '京东物流',
  '邮政': '中国邮政',
  'POST': '中国邮政',
  '天天': '天天快递',
  'TT': '天天快递',
  '德邦': '德邦快递',
  'DBL': '德邦快递',
  '宅急送': '宅急送',
  'ZJS': '宅急送',
  '优速': '优速快递',
  'US': '优速快递',
  '跨越': '跨越速运',
  'KYSY': '跨越速运',
  '安能': '安能物流',
  'ANE': '安能物流',
  '极兔': '极兔速递',
  'JT': '极兔速递',
};

/**
 * 消息模式匹配器
 * 使用正则表达式识别各类快递处理消息
 */
export class MessagePatternMatcher {
  /**
   * 匹配消息类型
   */
  match(text: string): MatchResult {
    const trimmed = text.trim();

    // 打招呼
    if (this.isHello(trimmed)) {
      return { type: 'HELLO', rawText: trimmed };
    }

    // 帮助
    if (this.isHelp(trimmed)) {
      return { type: 'HELP', rawText: trimmed };
    }

    // 拦截请求
    const interceptionMatch = this.matchInterceptionRequest(trimmed);
    if (interceptionMatch) {
      return interceptionMatch;
    }

    // 拦截成功
    const successMatch = this.matchInterceptionSuccess(trimmed);
    if (successMatch) {
      return successMatch;
    }

    // 拦截失败
    const failedMatch = this.matchInterceptionFailed(trimmed);
    if (failedMatch) {
      return failedMatch;
    }

    // 拒收
    const rejectMatch = this.matchReject(trimmed);
    if (rejectMatch) {
      return rejectMatch;
    }

    // 未收到
    const notReceivedMatch = this.matchNotReceived(trimmed);
    if (notReceivedMatch) {
      return notReceivedMatch;
    }

    // 地址异常
    const addressMatch = this.matchAddressIssue(trimmed);
    if (addressMatch) {
      return addressMatch;
    }

    // 破损
    const damageMatch = this.matchDamage(trimmed);
    if (damageMatch) {
      return damageMatch;
    }

    // 丢件
    const lostMatch = this.matchLost(trimmed);
    if (lostMatch) {
      return lostMatch;
    }

    // 查询
    const queryMatch = this.matchQuery(trimmed);
    if (queryMatch) {
      return queryMatch;
    }

    return { type: 'UNKNOWN', rawText: trimmed };
  }

  /**
   * 判断是否为打招呼
   */
  private isHello(text: string): boolean {
    const helloPatterns = [
      /^你好$/i, /^您好$/i, /^hi$/i, /^hello$/i,
      /^嗨$/i, /^hey$/i, /^hi\s/i, /^hello\s/i,
      /^你好\s/i, /^您好\s/i, /^晚上好$/i, /^早上好$/i,
      /^下午好$/i, /^中午好$/i
    ];
    return helloPatterns.some(pattern => pattern.test(text));
  }

  /**
   * 判断是否为帮助请求
   */
  private isHelp(text: string): boolean {
    const helpPatterns = [
      /^帮助$/i, /^help$/i, /^使用说明$/i, /^命令$/i,
      /^怎么用$/i, /^使用指南$/i, /^\?$/i, /^\/help$/i,
      /^功能$/i, /^支持$/i
    ];
    return helpPatterns.some(pattern => pattern.test(text));
  }

  /**
   * 匹配拦截请求
   * 格式：拦截快递：快递公司+单号 或 拦截：单号
   */
  private matchInterceptionRequest(text: string): MatchResult | null {
    // 模式1: 拦截快递：快递公司+单号
    // 例如: 拦截快递：韵达123456789, 拦截快递：中通987654321
    const pattern1 = /^拦截快递[：:]\s*([^\s\d]+)\s*(\d+)/i;
    const match1 = text.match(pattern1);
    if (match1) {
      const company = this.normalizeCompany(match1[1]);
      const number = match1[2];
      return {
        type: 'INTERCEPTION_REQUEST',
        expressCompany: company,
        trackingNumber: number,
        rawText: text
      };
    }

    // 模式2: 拦截+单号 (单号可能包含字母)
    // 例如: 拦截123456789, 拦截SF123456789
    const pattern2 = /^拦截\s*([A-Za-z]*\d+)/i;
    const match2 = text.match(pattern2);
    if (match2) {
      const number = match2[1];
      // 尝试提取快递公司
      const company = this.extractCompany(number);
      return {
        type: 'INTERCEPTION_REQUEST',
        expressCompany: company,
        trackingNumber: number,
        rawText: text
      };
    }

    // 模式3: 拦截+快递公司+单号
    // 例如: 拦截 韵达 123456789
    const pattern3 = /^拦截\s+([^\s]+)\s+(\d+)/i;
    const match3 = text.match(pattern3);
    if (match3) {
      const company = this.normalizeCompany(match3[1]);
      const number = match3[2];
      return {
        type: 'INTERCEPTION_REQUEST',
        expressCompany: company,
        trackingNumber: number,
        rawText: text
      };
    }

    return null;
  }

  /**
   * 匹配拦截成功
   * 例如: 已拦截, 已退回, 快递已退回仓库, 已拦截退回
   */
  private matchInterceptionSuccess(text: string): MatchResult | null {
    const successPatterns = [
      /^已拦截$/i, /^已退回$/i, /^快递已退回$/i, /^快递已退回仓库$/i,
      /^已拦截退回$/i, /^退回成功$/i, /^已安排退回$/i,
      /^核实无误.*已安排退回$/i
    ];

    if (successPatterns.some(pattern => pattern.test(text))) {
      // 尝试从文本中提取单号
      const number = this.extractTrackingNumber(text);
      return {
        type: 'INTERCEPTION_SUCCESS',
        trackingNumber: number,
        rawText: text
      };
    }

    return null;
  }

  /**
   * 匹配拦截失败
   * 例如: 已签收, 无法拦截, 买家已取件, 已签收入库
   */
  private matchInterceptionFailed(text: string): MatchResult | null {
    const failedPatterns = [
      /^已签收$/i, /^无法拦截$/i, /^买家已取件$/i, /^客户已取件$/i,
      /^已签收.*$/i, /^派送中.*已签收$/i
    ];

    if (failedPatterns.some(pattern => pattern.test(text))) {
      const number = this.extractTrackingNumber(text);
      return {
        type: 'INTERCEPTION_FAILED',
        trackingNumber: number,
        rawText: text
      };
    }

    return null;
  }

  /**
   * 匹配拒收
   * 例如: 拒收123456789, 拒收 单号
   */
  private matchReject(text: string): MatchResult | null {
    const pattern = /^拒收\s*(\d+)/i;
    const match = text.match(pattern);
    if (match) {
      return {
        type: 'REJECT',
        trackingNumber: match[1],
        rawText: text
      };
    }

    // 模式2: 拒收+原因+单号
    const pattern2 = /^拒收\s*([^0-9]+)?\s*(\d{8,})/i;
    const match2 = text.match(pattern2);
    if (match2) {
      return {
        type: 'REJECT',
        reason: match2[1]?.trim() || '买家拒收',
        trackingNumber: match2[2],
        rawText: text
      };
    }

    return null;
  }

  /**
   * 匹配未收到
   * 例如: 未收到123456789, 没收到123456789
   */
  private matchNotReceived(text: string): MatchResult | null {
    const patterns = [
      /^未收到\s*(\d+)/i,
      /^没收到\s*(\d+)/i,
      /^未取到\s*(\d+)/i,
      /^没有收到\s*(\d+)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return {
          type: 'NOT_RECEIVED',
          trackingNumber: match[1],
          rawText: text
        };
      }
    }

    return null;
  }

  /**
   * 匹配地址异常
   * 例如: 地址异常123456789, 电话不通123456789
   */
  private matchAddressIssue(text: string): MatchResult | null {
    const patterns = [
      /^地址异常\s*(\d+)/i,
      /^电话不通\s*(\d+)/i,
      /^地址不详\s*(\d+)/i,
      /^联系不上\s*(\d+)/i,
      /^收件人.*异常\s*(\d+)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return {
          type: 'ADDRESS_ISSUE',
          reason: this.extractReason(text),
          trackingNumber: match[1],
          rawText: text
        };
      }
    }

    return null;
  }

  /**
   * 匹配破损
   * 例如: 破损123456789, 外包装破损123456789
   */
  private matchDamage(text: string): MatchResult | null {
    const patterns = [
      /^破损\s*(\d+)/i,
      /^外包装破损\s*(\d+)/i,
      /^包裹破损\s*(\d+)/i,
      /^货物破损\s*(\d+)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return {
          type: 'DAMAGE',
          reason: '外包装破损',
          trackingNumber: match[1],
          rawText: text
        };
      }
    }

    return null;
  }

  /**
   * 匹配丢件
   * 例如: 丢件123456789, 无物流123456789
   */
  private matchLost(text: string): MatchResult | null {
    const patterns = [
      /^丢件\s*(\d+)/i,
      /^无物流\s*(\d+)/i,
      /^丢失\s*(\d+)/i,
      /^件丢失\s*(\d+)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return {
          type: 'LOST',
          trackingNumber: match[1],
          rawText: text
        };
      }
    }

    return null;
  }

  /**
   * 匹配查询
   * 例如: 查询123456789, 单号123456789
   */
  private matchQuery(text: string): MatchResult | null {
    const patterns = [
      /^查询\s*(\d+)/i,
      /^单号\s*(\d+)/i,
      /^跟踪\s*(\d+)/i,
      /^物流\s*(\d+)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return {
          type: 'QUERY',
          trackingNumber: match[1],
          rawText: text
        };
      }
    }

    return null;
  }

  /**
   * 标准化快递公司名称
   */
  private normalizeCompany(input: string): string {
    const trimmed = input.trim();
    return EXPRESS_COMPANY_MAP[trimmed] || trimmed;
  }

  /**
   * 从单号中提取快递公司
   */
  private extractCompany(number: string): string | undefined {
    // 顺丰单号以SF开头
    if (/^SF/i.test(number)) return '顺丰速运';
    // EMS单号以E开头
    if (/^E[A-Z]/i.test(number)) return 'EMS';
    // 京东单号以JD开头
    if (/^JD/i.test(number)) return '京东物流';
    return undefined;
  }

  /**
   * 从文本中提取快递单号
   */
  private extractTrackingNumber(text: string): string | undefined {
    // 匹配连续的数字
    const pattern = /(\d{10,})/;
    const match = text.match(pattern);
    return match ? match[1] : undefined;
  }

  /**
   * 提取原因描述
   */
  private extractReason(text: string): string {
    // 移除单号后的内容作为原因
    const withoutNumber = text.replace(/\d+/g, '').trim();
    // 移除常见前缀
    return withoutNumber.replace(/^(地址异常|电话不通|地址不详|联系不上|收件人)/i, '').trim() || '地址异常';
  }
}
