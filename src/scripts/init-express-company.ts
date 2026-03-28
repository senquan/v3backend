/**
 * 初始化快递公司数据
 * 运行方式: ts-node src/scripts/init-express-company.ts
 */
import { AppDataSource } from '../config/database';
import { ExpressCompany } from '../models/express-company.model';

const expressCompanies = [
  { name: '顺丰速运', code: 'SF', website: 'https://www.sf-express.com', phone: '95338' },
  { name: '中通快递', code: 'ZTO', website: 'https://www.zto.com', phone: '95720' },
  { name: '圆通速递', code: 'YTO', website: 'https://www.yto.net.cn', phone: '95554' },
  { name: '韵达快递', code: 'YUNDA', website: 'https://www.yunda56.com', phone: '95546' },
  { name: '申通快递', code: 'STO', website: 'https://www.sto.cn', phone: '95543' },
  { name: 'EMS', code: 'EMS', website: 'https://www.ems.com.cn', phone: '11183' },
  { name: '京东物流', code: 'JD', website: 'https://www.jdwl.com', phone: '950616' },
  { name: '中国邮政', code: 'YZPY', website: 'https://www.ems.com.cn', phone: '11185' },
  { name: '百世快递', code: 'HTKY', website: 'https://www.800best.com', phone: '95700' },
  { name: '天天快递', code: 'HHTT', website: 'https://www.ttkdex.com', phone: '400-188-8888' },
  { name: '德邦快递', code: 'DBL', website: 'https://www.deppon.com', phone: '95353' },
  { name: '宅急送', code: 'ZJS', website: 'https://www.zjs.com.cn', phone: '400-678-9000' },
  { name: '极兔速递', code: 'JT', website: 'https://www.jtexpress.com', phone: '956025' },
  { name: '安能物流', code: 'ANE', website: 'https://www.ane56.com', phone: '95561' },
  { name: '跨越速运', code: 'KYSY', website: 'https://www.ky-express.com', phone: '400-089-5555' },
  { name: '优速快递', code: 'US', website: 'https://www.youshu88.com', phone: '952480' },
  { name: '信丰物流', code: 'XF', website: 'https://www.xfex.com', phone: '400-830-6333' },
  { name: '速尔快递', code: 'SUR', website: 'https://www.sure365.com', phone: '95546' },
  { name: '龙邦速递', code: 'LB', website: 'https://www.lbex.com', phone: '400-678-9000' },
  { name: '国通快递', code: 'GTO', website: 'https://www.gto56.com', phone: '400-111-5556' },
];

async function initExpressCompany() {
  console.log('开始初始化快递公司数据...');

  // 初始化数据库连接
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  const repository = AppDataSource.getRepository(ExpressCompany);

  for (let i = 0; i < expressCompanies.length; i++) {
    const company = expressCompanies[i];

    // 检查是否已存在
    const existing = await repository.findOne({ where: { code: company.code } });
    if (existing) {
      console.log(`[跳过] ${company.name} (${company.code}) 已存在`);
      continue;
    }

    // 创建新记录
    const newCompany = repository.create({
      ...company,
      enabled: 1,
      sort: i + 1,
    });

    await repository.save(newCompany);
    console.log(`[创建] ${company.name} (${company.code})`);
  }

  console.log('快递公司数据初始化完成！');

  // 关闭数据库连接
  await AppDataSource.destroy();
}

initExpressCompany().catch((error) => {
  console.error('初始化失败:', error);
  process.exit(1);
});
