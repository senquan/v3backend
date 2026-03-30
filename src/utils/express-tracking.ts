interface Logistics {
  name: string; // 快递公司中文名
  prefixes: string[]; // 常见前缀（如 SF、YT、ST）
  patterns: RegExp[]; // 正则表达式（可选）
}

export function identifyLogisticsCompany(trackNumber: string): string {
  if (!trackNumber || typeof trackNumber !== 'string') {
    return '未知';
  }
  // 去掉空格与大小写统一
  const normalized = trackNumber.trim().toUpperCase();
  const logisticsList: Logistics[] = [
    // EMS（国际快递）
    {
      name: 'EMS',
      prefixes: ['EMS'],
      patterns: [/^E\d{10}CS$/, /^EMS\d{13}$/, /^(?:KA|PA|XA|SB)\d{11}$/]
    },
    // 京东物流
    {
      name: '京东物流',
      prefixes: ['JD', 'JDL'],
      patterns: [/^JD[A-Z]{1,2}\d{12}$/, /^JDL\d{10,13}$/]
    },
    // 极兔速递
    {
      name: '极兔速递',
      prefixes: ['JT'],
      patterns: [/^JT\d{13}$/]
    },
    // 德邦物流
    {
      name: '德邦',
      prefixes: ['DB', 'DEBANG', 'DPK', 'DPL'],
      patterns: [/^DP[KL]\d{12}$/, /^DB\d{12,14}$/]
    },
    // 顺丰速运
    {
      name: '顺丰',
      prefixes: ['SF', 'SFEXPRESS'],
      patterns: [/^SF\d{13}$/, /^\d{12}$/]
    },
    // 圆通速递
    {
      name: '圆通',
      prefixes: ['YT', 'YTO'],
      patterns: [/^YT\d{13}$/, /^\d{13}$/]
    },
    // 中通快递
    {
      name: '中通',
      prefixes: ['ZT', 'ZTO'],
      patterns: [/^ZT\d{12,13}$/, /^(?:7353\d{10}|2008\d{8}|6\d{11}|010\d{9})$/]
    },
    // 韵达快递
    {
      name: '韵达',
      prefixes: ['YD', 'YUNDA'],
      patterns: [/^YD\d{12}$/, /^(?:43415|31250)\d{10}$/]
    },
    // 申通快递
    {
      name: '申通',
      prefixes: ['ST'],
      patterns: [/^ST\d{12}$/, /^(?:268|368|58)\d{9}$/]
    },
    // 百世快递 (原汇通快递)
    {
      name: '百世',
      prefixes: ['BST', '888'],
      patterns: [/^BST\d{12,13}$/, /^888\d{9,10}$/]
    },
    // 菜鸟裹裹
    {
      name: '菜鸟裹裹',
      prefixes: ['CNS', 'CJ'],
      patterns: [/^CNS\d{12,14}$/, /^CJ\d{12,14}$/]
    },
    // UPS
    {
      name: 'UPS',
      prefixes: ['UPS'],
      patterns: [/^UPS\d{12}$/]
    },
    // DHL
    {
      name: 'DHL',
      prefixes: ['DHL'],
      patterns: [/^DHL\d{10}$/]
    },
    // FedEx
    {
      name: 'FedEx',
      prefixes: ['FEDEX', 'FX'],
      patterns: [/^FX\d{12}$/]
    },
    // 亚马逊物流（Amazon）
    {
      name: '亚马逊物流',
      prefixes: ['AMAZON'],
      patterns: [/^AMZ\d{10}$/]
    }
  ];
  for (const log of logisticsList) {
    if (log.patterns.some(pattern => pattern.test(normalized))) {
      return log.name;
    }
  }
  return '未知';
}